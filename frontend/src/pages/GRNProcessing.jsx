import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const itemStatusColors = {
  APPROVED: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  SHORTAGE: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  OVERAGE: 'bg-orange-100 text-orange-700 border border-orange-300',
  PENDING: 'bg-slate-100 text-slate-700 border border-slate-300'
};

const GRNProcessing = () => {
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [selectedGrnId, setSelectedGrnId] = useState(null);
  const [grnItems, setGrnItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

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
    fetchGRNs();
    fetchPurchaseOrders();
    fetchPOReceipts();
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
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/grn-items/${grnId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch GRN items');
      const data = await response.json();
      setGrnItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error('Error fetching GRN items:', error);
      Swal.fire('Error', 'Failed to load GRN items', 'error');
      setGrnItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleViewItems = (grnId) => {
    setSelectedGrnId(grnId);
    setShowItemsModal(true);
    fetchGrnItems(grnId);
  };

  const handleDeleteItem = async (itemId) => {
    const confirmDelete = await Swal.fire({
      title: 'Delete Item?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete'
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
      
      setGrnItems(grnItems.filter(item => item.id !== itemId));
      Swal.fire('Deleted', 'Item removed from GRN', 'success');
      fetchGRNs();
    } catch (error) {
      console.error('Error deleting item:', error);
      Swal.fire('Error', 'Failed to delete item', 'error');
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
      Swal.fire('Error', 'Failed to fetch PO details', 'error');
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
      Swal.fire('Error', 'Failed to fetch receipt details', 'error');
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
      Swal.fire('Error', 'Please select a PO with items', 'error');
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
          poQty: item.quantity,
          acceptedQty: accepted,
          remarks: data.remarks || null
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Swal.fire('Validation Error', 'Please fix errors in the form', 'error');
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

      await Swal.fire('Success', `GRN created successfully (GRN ID: ${result.grn_id})`, 'success');

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
      Swal.fire('Error', error.message || 'Failed to create GRN', 'error');
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

      Swal.fire('Success', 'GRN deleted successfully', 'success');
      fetchGRNs();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete GRN', 'error');
    }
  };

  const filteredGRNs = grns.filter(grn =>
    grn.poNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card title="GRN Processing" subtitle="Create GRN with Item-wise Shortage, Overage & Rejection Handling">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search PO number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
          >
            + Create GRN
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading GRNs...</p>
        ) : filteredGRNs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No GRNs {searchTerm ? 'found' : 'created yet'}</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              + Create Your First GRN
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">GRN ID</th>
                  <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                  <th className="px-4 py-3 text-left font-semibold">Receipt Ref</th>
                  <th className="px-4 py-3 text-left font-semibold">GRN Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Received Qty</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGRNs.map((grn) => (
                  <tr key={grn.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{grn.id}</td>
                    <td className="px-4 py-4 text-slate-600">{grn.poNumber || '—'}</td>
                    <td className="px-4 py-4">
                      {grn.receiptId ? (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium border border-blue-100">
                          REC-{grn.receiptId}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {grn.grnDate ? new Date(grn.grnDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-4 text-right font-medium">{grn.receivedQuantity || 0}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${itemStatusColors[grn.status] || itemStatusColors.PENDING}`}>
                        {grn.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewItems(grn.id)}
                        className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium"
                      >
                        + View
                      </button>
                      <button
                        onClick={() => handleDeleteGRN(grn.id)}
                        className="px-3 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full m-4 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Create GRN (Goods Received Note)</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Purchase Order *
                  </label>
                  <select
                    value={formData.poId}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select PO...</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.po_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    PO Receipt (Optional)
                  </label>
                  <select
                    value={selectedReceiptId}
                    onChange={(e) => handleReceiptSelect(e.target.value)}
                    disabled={!formData.poId}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    GRN Date *
                  </label>
                  <input
                    type="date"
                    value={formData.grnDate}
                    onChange={(e) => setFormData({ ...formData, grnDate: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Any notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {formData.poId && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-wider">Vendor</p>
                    <p className="font-bold text-slate-900">
                      {purchaseOrders.find(p => String(p.id) === String(formData.poId))?.vendor_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-wider">PO Total</p>
                    <p className="font-bold text-slate-900">
                      ₹{purchaseOrders.find(p => String(p.id) === String(formData.poId))?.total_amount?.toLocaleString('en-IN') || '0'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-wider">Expected Delivery</p>
                    <p className="font-bold text-slate-900">
                      {new Date(purchaseOrders.find(p => String(p.id) === String(formData.poId))?.expected_delivery_date).toLocaleDateString('en-IN') || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-wider">Status</p>
                    <p className="font-bold text-emerald-600">
                      {purchaseOrders.find(p => String(p.id) === String(formData.poId))?.status || 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {poItems.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">PO Items - Enter Accepted Quantities</h3>
                    <p className="text-xs text-slate-500 mt-1">Enter how much you accepted. Status shows: APPROVED (match), SHORTAGE (less), OVERAGE (more)</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold min-w-[100px]">Item Code</th>
                          <th className="px-4 py-2 text-left font-semibold min-w-[180px]">Description</th>
                          <th className="px-4 py-2 text-center font-semibold min-w-[70px]">PO Qty</th>
                          <th className="px-4 py-2 text-center font-semibold min-w-[70px]">Accepted *</th>
                          <th className="px-4 py-2 text-center font-semibold min-w-[70px]">Difference</th>
                          <th className="px-4 py-2 text-center font-semibold min-w-[120px]">Status</th>
                          <th className="px-4 py-2 text-center font-semibold min-w-[100px]">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poItems.map((item) => {
                          const data = itemData[item.id] || {};
                          const accepted = parseInt(data.acceptedQty) || 0;
                          const { status, difference } = calculateMetrics(
                            item.quantity,
                            accepted
                          );
                          const itemError = validationErrors[item.id];

                          return (
                            <tr
                              key={item.id}
                              className={`border-t border-slate-200 ${
                                itemError ? 'bg-red-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-4 py-3 font-medium text-slate-900">{item.item_code || item.itemCode || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{item.description || '—'}</td>
                              <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={data.acceptedQty}
                                  onChange={(e) => handleItemChange(item.id, 'acceptedQty', e.target.value)}
                                  placeholder="0"
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-4 py-3 text-center font-medium">
                                {difference !== 0 ? (difference > 0 ? `+${difference}` : difference) : '0'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded ${itemStatusColors[status] || itemStatusColors.PENDING}`}>
                                  {status === 'PENDING' ? '—' : status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={data.remarks}
                                  onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                                  placeholder="Notes..."
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {Object.keys(validationErrors).length > 0 && (
                    <div className="bg-red-50 px-4 py-3 border-t border-red-200">
                      <p className="text-sm font-semibold text-red-900 mb-2">Validation Errors:</p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {Object.entries(validationErrors).map(([itemId, errors]) => (
                          <li key={itemId}>
                            <strong>{poItems.find(i => i.id == itemId)?.itemCode}:</strong> {errors.join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || poItems.length === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating GRN...' : 'Create GRN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItemsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-5xl w-full m-4 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">GRN Items</h2>
              <button
                onClick={() => setShowItemsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            {itemsLoading ? (
              <p className="text-center py-8 text-slate-500">Loading items...</p>
            ) : grnItems.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No items in this GRN</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Item Code</th>
                      <th className="px-4 py-3 text-left font-semibold">Description</th>
                      <th className="px-4 py-3 text-center font-semibold">PO Qty</th>
                      <th className="px-4 py-3 text-center font-semibold">Received</th>
                      <th className="px-4 py-3 text-center font-semibold">Accepted</th>
                      <th className="px-4 py-3 text-center font-semibold">Rejected</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grnItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-900">{item.item_code || '—'}</td>
                        <td className="px-4 py-4 text-slate-600">{item.description || '—'}</td>
                        <td className="px-4 py-4 text-center">{item.po_qty || 0}</td>
                        <td className="px-4 py-4 text-center">{item.received_qty || 0}</td>
                        <td className="px-4 py-4 text-center font-medium">{item.accepted_qty || 0}</td>
                        <td className="px-4 py-4 text-center">{item.rejected_qty || 0}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${itemStatusColors[item.status] || itemStatusColors.PENDING}`}>
                            {item.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="px-3 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowItemsModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GRNProcessing;
