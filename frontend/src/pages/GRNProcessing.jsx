import { useState, useEffect, useCallback } from 'react';
import { Card, DataTable, Badge } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

const itemStatusColors = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SHORTAGE: 'bg-amber-50 text-amber-700 border-amber-200',
  OVERAGE: 'bg-orange-50 text-orange-700 border-orange-200',
  PENDING: 'bg-slate-50 text-slate-700 border-slate-200'
};

const GRNProcessing = () => {
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [itemsLoading, setItemsLoading] = useState({});
  const [user, setUser] = useState(null);

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
      }
    } else {
      fetchGRNs();
      fetchPurchaseOrders();
      fetchPOReceipts();
    }
  }, []);

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
    } catch (error) {
      console.error('Error fetching GRNs:', error);
      setGrns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGrnItems = async (grnId) => {
    try {
      setItemsLoading(prev => ({ ...prev, [grnId]: true }));
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grn-items/${grnId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch GRN items');
      const data = await response.json();
      setExpandedItems(prev => ({ ...prev, [grnId]: Array.isArray(data.items) ? data.items : [] }));
    } catch (error) {
      console.error('Error fetching GRN items:', error);
      errorToast('Failed to load GRN items');
    } finally {
      setItemsLoading(prev => ({ ...prev, [grnId]: false }));
    }
  };

  const fetchGrnItemsIfNeeded = useCallback((grnId) => {
    if (!expandedItems[grnId] && !itemsLoading[grnId]) {
      fetchGrnItems(grnId);
    }
  }, [expandedItems, itemsLoading]);

  const handleDeleteItem = async (itemId, grnId) => {
    const confirmDelete = await Swal.fire({
      title: 'Delete Item?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
      cancelButtonColor: '#64748b'
    });

    if (!confirmDelete.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grn-items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete item');
      
      setExpandedItems(prev => ({
        ...prev,
        [grnId]: prev[grnId].filter(item => item.id !== itemId)
      }));
      successToast('Item removed from GRN');
      fetchGRNs();
    } catch (error) {
      console.error('Error deleting item:', error);
      errorToast('Failed to delete item');
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
          // item here is from po_receipt_items which has po_item_id
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

  const calculateMetrics = (poQty, acceptedQty) => {
    const po = Number(poQty);
    const accepted = Number(acceptedQty);
    const status = getItemStatus(po, accepted);
    const difference = po - accepted;
    const shortageQty = status === 'SHORTAGE' ? po - accepted : 0;
    const overageQty = status === 'OVERAGE' ? accepted - po : 0;

    return { status, difference, shortageQty, overageQty };
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

  const columns = [
    { label: 'GRN ID', key: 'id', sortable: true, render: (val) => <span className=" text-indigo-600">GRN-{val}</span> },
    { label: 'PO Number', key: 'poNumber', sortable: true },
    { 
      label: 'Receipt Ref', 
      key: 'receiptId', 
      render: (val) => val ? (
        <Badge variant="blue">REC-{val}</Badge>
      ) : <span className="text-slate-400">—</span>
    },
    { 
      label: 'GRN Date', 
      key: 'grnDate', 
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '—'
    },
    { 
      label: 'Received Qty', 
      key: 'receivedQuantity', 
      className: 'text-right',
      render: (val) => <span className=" text-slate-900">{val || 0}</span>
    },
    { 
      label: 'Status', 
      key: 'status',
      render: (val) => (
        <Badge className={itemStatusColors[val] || itemStatusColors.PENDING}>
          {val || 'Pending'}
        </Badge>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteGRN(row.id);
            }}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete GRN"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const renderExpanded = (row) => {
    fetchGrnItemsIfNeeded(row.id);
    const items = expandedItems[row.id] || [];
    const isLoading = itemsLoading[row.id];

    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No items found for this GRN
        </div>
      );
    }

    return (
      <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/80 text-slate-500   tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Material / Description</th>
              <th className="px-4 py-3 text-left">Type / Drawing</th>
              <th className="px-4 py-3 text-center">PO Qty</th>
              <th className="px-4 py-3 text-center">Accepted</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-white/80 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{item.material_name}</div>
                  <div className="text-slate-500 truncate max-w-[200px]">{item.description}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-600">{item.material_type}</div>
                  <div className="text-indigo-600 font-medium">{item.drawing_no}</div>
                </td>
                <td className="px-4 py-3 text-center font-medium">{item.po_qty}</td>
                <td className="px-4 py-3 text-center  text-indigo-600">{item.accepted_qty}</td>
                <td className="px-4 py-3 text-center">
                  <Badge className={itemStatusColors[item.status] || itemStatusColors.PENDING}>
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right pr-6">
                  <button
                    onClick={() => handleDeleteItem(item.id, row.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl  text-slate-900">GRN Processing</h1>
          <p className="text-slate-500 mt-1">Manage Goods Received Notes and track material shortages</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm  hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Create GRN
        </button>
      </div>

      <DataTable
        columns={columns}
        data={grns}
        loading={loading}
        renderExpanded={renderExpanded}
        searchPlaceholder="Search PO numbers..."
        emptyMessage="No GRNs found"
      />


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

