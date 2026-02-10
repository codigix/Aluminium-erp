import { useState, useEffect } from 'react';
import { Card, DataTable, Badge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast } from '../utils/toast';
import { 
  ShieldCheck, 
  LayoutGrid, 
  List, 
  RefreshCw, 
  Search, 
  Filter, 
  Columns, 
  Download, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Package, 
  FileText, 
  Printer, 
  Eye,
  Inbox
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const itemStatusColors = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SHORTAGE: 'bg-amber-50 text-amber-700 border-amber-200',
  OVERAGE: 'bg-orange-50 text-orange-700 border-orange-200',
  PENDING: 'bg-slate-50 text-slate-700 border-slate-200',
  RECEIVED: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200'
};

const StatCard = ({ label, value, icon: Icon, colorClass, iconBg }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 min-w-[140px]">
    <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-[10px]  text-slate-500  tracking-wider uppercase">{label}</p>
      <p className="text-xl text-slate-900 leading-tight">{value}</p>
    </div>
  </div>
);

const GRNProcessing = () => {
  const [grns, setGrns] = useState([]);
  const [stats, setStats] = useState({
    totalGrns: 0,
    pendingGrns: 0,
    qcReview: 0,
    awaitingStorage: 0,
    completed: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const [formData, setFormData] = useState({
    poId: '',
    grnDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poReceipts, setPoReceipts] = useState([]);
  const [poItems, setPoItems] = useState([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [itemData, setItemData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.department_code === 'ADMIN' || parsedUser.department_code === 'INVENTORY') {
        fetchGRNs();
        fetchPurchaseOrders();
        fetchPOReceipts();
        fetchStats();
      }
    } else {
      fetchGRNs();
      fetchPurchaseOrders();
      fetchPOReceipts();
      fetchStats();
    }
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Map backend stats to UI labels
        setStats({
          totalGrns: data.totalGrns || 0,
          pendingGrns: data.pendingGrns || 0,
          qcReview: data.receivedGrns || 0, // Received but not yet approved
          awaitingStorage: 0, // We don't have this status yet, placeholder
          completed: data.approvedGrns || 0,
          rejected: data.rejectedGrns || 0
        });
      }
    } catch (error) {
      console.error('Error fetching GRN stats:', error);
    }
  };

  const fetchPOReceipts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPoReceipts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching PO receipts:', error);
    }
  };



  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders?storeAcceptanceStatus=ACCEPTED`, {
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

  const handlePOSelect = async (poId) => {
    setFormData({ ...formData, poId });
    setSelectedReceiptId('');
    setPoItems([]);
    setItemData({});
    setValidationErrors({});

    if (!poId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const po = await response.json();
        setPoItems(po.items || []);

        const initialData = {};
        (po.items || []).forEach(item => {
          initialData[item.id] = {
            acceptedQty: '',
            remarks: ''
          };
        });
        setItemData(initialData);
      }
    } catch (error) {
      console.error('Error fetching PO details:', error);
      errorToast('Failed to fetch PO details');
    }
  };

  const handleReceiptSelect = async (receiptId) => {
    setSelectedReceiptId(receiptId);
    if (!receiptId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const receipt = await response.json();
        const updatedItemData = { ...itemData };
        
        (receipt.items || []).forEach(item => {
          if (updatedItemData[item.po_item_id]) {
            updatedItemData[item.po_item_id].acceptedQty = item.received_quantity;
          }
        });
        
        setItemData(updatedItemData);
        setFormData({ ...formData, notes: receipt.notes || formData.notes });
      }
    } catch (error) {
      console.error('Error fetching receipt details:', error);
      errorToast('Failed to fetch receipt details');
    }
  };

  const validateItemInput = (poItemId, accepted) => {
    const errors = [];
    if (!accepted && accepted !== 0) {
      errors.push('Accepted Qty required');
    }
    if (parseInt(accepted) < 0) {
      errors.push('Accepted Qty cannot be negative');
    }
    return errors;
  };

  const getItemStatus = (poQty, acceptedQty) => {
    const po = Number(poQty);
    const accepted = Number(acceptedQty);
    if (accepted === po) return 'APPROVED';
    if (accepted < po) return 'SHORTAGE';
    if (accepted > po) return 'OVERAGE';
    return 'PENDING';
  };

  const handleItemChange = (itemId, field, value) => {
    setItemData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));

    if (validationErrors[itemId]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    }
  };

  const handleCreateGRN = async (e) => {
    e.preventDefault();
    if (!formData.poId || poItems.length === 0) {
      errorToast('Please select a PO with items');
      return;
    }

    const errors = {};
    const items = [];

    for (const item of poItems) {
      const data = itemData[item.id];
      if (!data) {
        errors[item.id] = ['Item data not found'];
        continue;
      }

      const accepted = parseInt(data.acceptedQty) || 0;
      const itemErrors = validateItemInput(item.id, data.acceptedQty);
      if (itemErrors.length > 0) {
        errors[item.id] = itemErrors;
      } else {
        items.push({
          poItemId: item.id,
          itemCode: item.item_code || item.itemCode,
          description: item.description,
          materialName: item.material_name,
          materialType: item.material_type,
          drawingNo: item.drawing_no,
          poQty: item.quantity,
          acceptedQty: accepted,
          remarks: data.remarks || null
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      errorToast('Please fix errors in the form');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grn-items/create-with-items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poId: parseInt(formData.poId),
          receiptId: selectedReceiptId ? parseInt(selectedReceiptId) : null,
          grnDate: formData.grnDate,
          notes: formData.notes || null,
          items
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create GRN');
      }

      const result = await response.json();
      successToast(`GRN created successfully (GRN ID: ${result.grn_id})`);
      setShowModal(false);
      setFormData({
        poId: '',
        grnDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setPoItems([]);
      setItemData({});
      setValidationErrors({});
      fetchGRNs();
    } catch (error) {
      console.error('Error creating GRN:', error);
      errorToast(error.message || 'Failed to create GRN');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGRN = async (grnId) => {
    const result = await Swal.fire({
      title: 'Delete GRN?',
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
      const response = await fetch(`${API_BASE}/grns/${grnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete GRN');
      successToast('GRN deleted successfully');
      fetchGRNs();
    } catch (error) {
      errorToast(error.message || 'Failed to delete GRN');
    }
  };

  const fetchGRNs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grns`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        setGrns([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch GRNs');
      const data = await response.json();
      setGrns(Array.isArray(data) ? data : []);
      fetchStats();
    } catch (error) {
      console.error('Error fetching GRNs:', error);
      setGrns([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredGrns = grns.filter(grn => {
    const matchesSearch = 
      String(grn.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      grn.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grn.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || grn.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { 
      label: 'GRN Number', 
      key: 'id', 
      sortable: true, 
      render: (val) => <span className="font-mono font-medium text-slate-900">GRN-{String(val).padStart(4, '0')}</span> 
    },
    { 
      label: 'PO Number', 
      key: 'poNumber', 
      sortable: true,
      render: (val) => <span className="text-slate-600">{val || '—'}</span>
    },
    { 
      label: 'Supplier', 
      key: 'vendorName', 
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-medium">
            {val ? val.charAt(0).toUpperCase() : '?'}
          </div>
          <span className="text-slate-700 font-medium">{val || '—'}</span>
        </div>
      )
    },
    { 
      label: 'Status', 
      key: 'status',
      render: (val) => {
        const statusMap = {
          'PENDING': 'pending',
          'RECEIVED': 'qc review',
          'APPROVED': 'completed',
          'REJECTED': 'rejected'
        };
        const displayStatus = statusMap[val] || (val ? val.toLowerCase() : 'pending');
        return (
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider border ${itemStatusColors[val] || itemStatusColors.PENDING}`}>
            {displayStatus}
          </div>
        );
      }
    },
    { 
      label: 'Items', 
      key: 'items_count',
      render: (_, row) => (
        <span className="font-medium text-slate-700">
          {row.items_count || 0} items
        </span>
      )
    },
    { 
      label: 'Date', 
      key: 'createdAt', 
      sortable: true,
      render: (val) => (
        <div className="text-slate-500 text-xs">
          <div>{val ? new Date(val).toLocaleDateString('en-GB') : '—'}</div>
          <div className="text-[10px] opacity-70">{val ? new Date(val).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button
            className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-colors flex items-center gap-1.5 text-[10px] font-medium"
            title="Print GRN"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // handleViewGRN(row.id);
            }}
            className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteGRN(row.id);
            }}
            className="p-1.5 bg-rose-50 border border-rose-100 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors shadow-sm"
            title="Delete GRN"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];



  return (
    <div className="p-4 space-y-6 bg-slate-50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Quality Control</h1>
            <p className="text-slate-500 text-sm">Manage Goods Received Notes & Inspections</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={() => { fetchGRNs(); fetchStats(); }}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats section */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          label="Total GRNs" 
          value={stats.totalGrns} 
          icon={FileText} 
          iconBg="bg-blue-50" 
          colorClass="text-blue-600" 
        />
        <StatCard 
          label="Pending" 
          value={stats.pendingGrns} 
          icon={Clock} 
          iconBg="bg-amber-50" 
          colorClass="text-amber-600" 
        />
        <StatCard 
          label="QC Review" 
          value={stats.qcReview} 
          icon={ShieldCheck} 
          iconBg="bg-indigo-50" 
          colorClass="text-indigo-600" 
        />
        <StatCard 
          label="Awaiting Storage" 
          value={stats.awaitingStorage} 
          icon={Package} 
          iconBg="bg-purple-50" 
          colorClass="text-purple-600" 
        />
        <StatCard 
          label="Completed" 
          value={stats.completed} 
          icon={CheckCircle2} 
          iconBg="bg-emerald-50" 
          colorClass="text-emerald-600" 
        />
        <StatCard 
          label="Rejected" 
          value={stats.rejected} 
          icon={XCircle} 
          iconBg="bg-rose-50" 
          colorClass="text-rose-600" 
        />
      </div>

      {/* Filter/Actions bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search GRN, PO, or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 md:flex-none">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-600 focus:outline-none min-w-[120px]"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">QC Review</option>
              <option value="APPROVED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          
          <button className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium shadow-sm transition-all">
            <Columns className="w-4 h-4" />
            <span className="hidden md:inline">Columns</span>
          </button>
          
          <button className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium shadow-sm transition-all">
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredGrns}
          loading={loading}
          searchPlaceholder="Search PO numbers..."
          emptyMessage="No GRNs found"
          hideSearch={true} // We have our own search bar
        />
      </div>


      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h2 className="text-xl text-slate-900">Create GRN</h2>
                <p className="text-sm text-slate-500">Record material receipt and verify quantities</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-sm  text-slate-700">Purchase Order *</label>
                  <select
                    value={formData.poId}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="">Select PO...</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.po_number}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm  text-slate-700">Receipt Ref (Optional)</label>
                  <select
                    value={selectedReceiptId}
                    onChange={(e) => handleReceiptSelect(e.target.value)}
                    disabled={!formData.poId}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none disabled:opacity-50"
                  >
                    <option value="">Select Receipt...</option>
                    {poReceipts
                      .filter(r => String(r.po_id) === String(formData.poId))
                      .map((receipt) => (
                        <option key={receipt.id} value={receipt.id}>
                          {new Date(receipt.receipt_date).toLocaleDateString()} - {receipt.received_quantity} Qty
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm  text-slate-700">GRN Date *</label>
                  <input
                    type="date"
                    value={formData.grnDate}
                    onChange={(e) => setFormData({ ...formData, grnDate: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm  text-slate-700">Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Reference notes..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>

              {formData.poId && (
                <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <div>
                    <div className="text-[10px]  tracking-wider  text-indigo-400">Vendor</div>
                    <div className="text-sm  text-slate-900">
                      {purchaseOrders.find(p => String(p.id) === String(formData.poId))?.vendor_name || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]  tracking-wider  text-indigo-400">PO Total</div>
                    <div className="text-sm  text-slate-900">
                      ₹{purchaseOrders.find(p => String(p.id) === String(formData.poId))?.total_amount?.toLocaleString('en-IN') || '0'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]  tracking-wider  text-indigo-400">Delivery Date</div>
                    <div className="text-sm  text-slate-900">
                      {new Date(purchaseOrders.find(p => String(p.id) === String(formData.poId))?.expected_delivery_date).toLocaleDateString('en-IN') || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]  tracking-wider  text-indigo-400">PO Status</div>
                    <div className="text-sm">
                      <Badge variant="success">
                        {purchaseOrders.find(p => String(p.id) === String(formData.poId))?.status || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {poItems.length > 0 && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-2 bg-slate-50 border-b border-slate-200">
                    <h3 className=" text-slate-900">PO Items</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Enter actual accepted quantities to track shortages</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/50 text-slate-500 text-[10px]   ">
                        <tr>
                          <th className="px-6 py-3 text-left">Material Details</th>
                          <th className="px-6 py-3 text-center">PO Qty</th>
                          <th className="px-6 py-3 text-center w-32">Accepted *</th>
                          <th className="px-6 py-3 text-center w-32">Status</th>
                          <th className="px-6 py-3 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {poItems.map((item) => {
                          const data = itemData[item.id] || {};
                          const accepted = parseInt(data.acceptedQty) || 0;
                          const { status } = calculateMetrics(item.quantity, accepted);
                          const itemError = validationErrors[item.id];

                          return (
                            <tr key={item.id} className={itemError ? 'bg-red-50/50' : 'hover:bg-slate-50/30'}>
                              <td className="p-2">
                                <div className=" text-slate-900">{item.material_name}</div>
                                <div className="text-xs text-slate-500">{item.material_type} • {item.drawing_no || 'No Drawing'}</div>
                              </td>
                              <td className="p-2 text-center font-medium text-slate-700">{item.quantity}</td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={data.acceptedQty}
                                  onChange={(e) => handleItemChange(item.id, 'acceptedQty', e.target.value)}
                                  className={`w-full px-3 py-1.5 bg-white border ${itemError ? 'border-red-300' : 'border-slate-200'} rounded-lg text-center  text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none`}
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Badge className={itemStatusColors[status] || itemStatusColors.PENDING}>
                                  {status === 'PENDING' ? '—' : status}
                                </Badge>
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={data.remarks || ''}
                                  onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                                  placeholder="Notes..."
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </form>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700  hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGRN}
                disabled={submitting || poItems.length === 0}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white  hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 active:scale-95"
              >
                {submitting ? 'Processing...' : 'Create GRN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GRNProcessing;

