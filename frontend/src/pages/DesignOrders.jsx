import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const DesignOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Details Modal State
  const [showDetails, setShowDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewDetails, setReviewDetails] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Item Edit State
  const [editingItem, setEditingItem] = useState(null);
  const [editItemData, setEditItemData] = useState({
    drawing_no: '',
    revision_no: '',
    drawing_pdf: null
  });
  const [itemSaveLoading, setItemSaveLoading] = useState(false);

  // Bulk Operations State
  const [selectedIncomingOrders, setSelectedIncomingOrders] = useState(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [expandedIncomingPo, setExpandedIncomingPo] = useState({});
  const [expandedActivePo, setExpandedActivePo] = useState({});

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [materialFormData, setMaterialFormData] = useState({
    itemCode: '',
    itemName: '',
    itemGroup: '',
    defaultUom: 'Nos',
    valuationRate: 0,
    sellingRate: 0,
    noOfCavity: 1,
    weightPerUnit: 0,
    weightUom: '',
    drawingNo: '',
    revision: '',
    materialGrade: ''
  });
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [targetOrderItemId, setTargetOrderItemId] = useState(null);
  const [itemsList, setItemsList] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [isEditingMaterial, setIsEditingMaterial] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  const fetchItemsList = useCallback(async (drawingNo = null) => {
    try {
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      let url = `${API_BASE}/stock/balance`;
      if (drawingNo) {
        url += `?drawingNo=${encodeURIComponent(drawingNo)}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItemsList(data);
      }
    } catch (error) {
      console.error('Failed to fetch items list:', error);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const toggleIncomingPo = (po) => {
    setExpandedIncomingPo(prev => ({ ...prev, [po]: !prev[po] }));
  };

  const toggleActivePo = (po) => {
    setExpandedActivePo(prev => ({ ...prev, [po]: !prev[po] }));
  };

  const groupedIncoming = incomingOrders.reduce((acc, order) => {
    const key = order.po_number || 'NO-PO';
    if (!acc[key]) {
      acc[key] = {
        po_number: key,
        company_name: order.company_name,
        orders: []
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {});

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch design orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingOrders = async () => {
    try {
      setIncomingLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/incoming?department=DESIGN_ENG`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch incoming orders');
      const data = await response.json();
      setIncomingOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIncomingLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchIncomingOrders();
  }, []);

  useEffect(() => {
    if (showAddMaterialModal) {
      fetchItemsList(materialFormData.drawingNo);
    }
  }, [materialFormData.drawingNo, showAddMaterialModal, fetchItemsList]);

  const handleViewOrder = async (order) => {
    try {
      setReviewLoading(true);
      setReviewOrder(order);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch order items');
      const items = await response.json();
      setReviewDetails(items || []);
      setShowReviewModal(true);
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/design-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      Swal.fire('Success', `Design order status updated to ${status}`, 'success');
      fetchOrders();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleApproveDesign = async (orderId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/approve-design`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      
      if (!response.ok) throw new Error('Failed to approve design');
      
      Swal.fire('Success', 'Design approved. Sent to Sales for quotation.', 'success');
      setShowReviewModal(false);
      fetchIncomingOrders();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleRejectDesign = async (orderId) => {
    const result = await Swal.fire({
      title: 'Reject Design',
      input: 'textarea',
      inputLabel: 'Rejection reason',
      inputPlaceholder: 'Enter reason for rejection...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Please enter a reason';
      }
    });
    
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/${orderId}/reject-design`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason: result.value })
        });
        
        if (!response.ok) throw new Error('Failed to reject design');
        
        Swal.fire('Success', 'Design rejected and sent back to sales.', 'success');
        setShowReviewModal(false);
        fetchIncomingOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const toggleSelectOrder = (orderId) => {
    const newSelected = new Set(selectedIncomingOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedIncomingOrders(newSelected);
  };

  const toggleSelectAllOrders = () => {
    if (selectedIncomingOrders.size === incomingOrders.length && incomingOrders.length > 0) {
      setSelectedIncomingOrders(new Set());
    } else {
      setSelectedIncomingOrders(new Set(incomingOrders.map(o => o.id)));
    }
  };

  const handleAcceptAll = async (orderIds) => {
    if (!orderIds || orderIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Accept & Send to Quotation',
      text: `Are you sure you want to accept all ${orderIds.length} items and send them to the Client Quotation page?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Accept All'
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/approve-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds })
        });

        if (!response.ok) throw new Error('Failed to accept orders');

        await Swal.fire('Success', 'Orders accepted and sent to Quotation page', 'success');
        navigate('/client-quotations');
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIncomingOrders.size === 0) {
      Swal.fire('Info', 'Please select at least one order to approve', 'info');
      return;
    }

    const result = await Swal.fire({
      title: 'Bulk Approve Designs',
      text: `Are you sure you want to approve ${selectedIncomingOrders.size} design(s) and send them to Sales for quotation?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, approve all'
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/approve-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds: Array.from(selectedIncomingOrders) })
        });

        if (!response.ok) throw new Error('Failed to approve designs');

        Swal.fire('Success', `${selectedIncomingOrders.size} designs approved and sent to Sales department.`, 'success');
        setSelectedIncomingOrders(new Set());
        fetchIncomingOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleBulkReject = async () => {
    if (selectedIncomingOrders.size === 0) {
      Swal.fire('Info', 'Please select at least one order to reject', 'info');
      return;
    }

    const result = await Swal.fire({
      title: 'Bulk Reject Designs',
      input: 'textarea',
      inputLabel: 'Rejection reason (required for all selected orders)',
      inputPlaceholder: 'Enter reason for rejection...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return 'Please enter a reason';
      }
    });

    if (result.isConfirmed) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/bulk/reject-designs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ orderIds: Array.from(selectedIncomingOrders), reason: result.value })
        });

        if (!response.ok) throw new Error('Failed to reject designs');

        Swal.fire('Success', `${selectedIncomingOrders.size} designs rejected and sent back to Sales.`, 'success');
        setSelectedIncomingOrders(new Set());
        fetchIncomingOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleViewDetails = async (order) => {
    try {
      setSelectedOrder(order);
      setShowDetails(true);
      setDetailsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.sales_order_id}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setOrderDetails(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load order details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditItemData({
      drawing_no: item.drawing_no || '',
      revision_no: item.revision_no || '0',
      drawing_pdf: null
    });
  };

  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!materialFormData.itemCode || !materialFormData.itemName || !materialFormData.itemGroup) {
      Swal.fire('Error', 'Please fill all required fields', 'error');
      return;
    }
    
    setIsSubmittingMaterial(true);
    try {
      const token = localStorage.getItem('authToken');
      const url = isEditingMaterial ? `${API_BASE}/stock/items/${editingMaterialId}` : `${API_BASE}/stock/items`;
      const method = isEditingMaterial ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(materialFormData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditingMaterial ? 'update' : 'create'} material`);
      }

      // If we have a target order item, update its item_code (only for creation usually, but good to have)
      if (targetOrderItemId && !isEditingMaterial) {
        await fetch(`${API_BASE}/sales-orders/items/${targetOrderItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ item_code: materialFormData.itemCode })
        });
      }
      
      Swal.fire('Success', `Material ${isEditingMaterial ? 'updated' : 'created'} successfully`, 'success');
      fetchItemsList(materialFormData.drawingNo);
      const nextCode = !isEditingMaterial ? await fetchNextItemCode() : '';
      setTargetOrderItemId(null);
      setIsEditingMaterial(false);
      setEditingMaterialId(null);
      fetchOrders();
      fetchIncomingOrders();
      if (showDetails && selectedOrder) {
        handleViewDetails(selectedOrder);
      }
      setMaterialFormData({
        itemCode: isEditingMaterial ? materialFormData.itemCode : (nextCode || ''),
        itemName: '',
        itemGroup: '',
        defaultUom: 'Nos',
        valuationRate: 0,
        sellingRate: 0,
        noOfCavity: 1,
        weightPerUnit: 0,
        weightUom: '',
        drawingNo: materialFormData.drawingNo,
        revision: materialFormData.revision,
        materialGrade: ''
      });
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  const fetchNextItemCode = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/items/next-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        return data.itemCode;
      }
    } catch (error) {
      console.error('Failed to fetch next item code:', error);
    }
    return '';
  };

  const openAddMaterialModal = async (item = null) => {
    let nextCode = '';
    if (!item || !item.item_code) {
      nextCode = await fetchNextItemCode();
    }

    if (item) {
      setTargetOrderItemId(item.item_id || item.id || null);
      setMaterialFormData({
        itemCode: item.item_code || nextCode || '',
        itemName: item.description || item.itemName || '',
        itemGroup: '',
        defaultUom: item.unit || 'Nos',
        valuationRate: 0,
        sellingRate: 0,
        noOfCavity: 1,
        weightPerUnit: 0,
        weightUom: '',
        drawingNo: item.drawing_no || '',
        revision: item.revision_no || '',
        materialGrade: ''
      });
    } else {
      setTargetOrderItemId(null);
      setMaterialFormData({
        itemCode: nextCode,
        itemName: '',
        itemGroup: '',
        defaultUom: 'Nos',
        valuationRate: 0,
        sellingRate: 0,
        noOfCavity: 1,
        weightPerUnit: 0,
        weightUom: '',
        drawingNo: '',
        revision: '',
        materialGrade: ''
      });
    }
    setShowAddMaterialModal(true);
    setIsEditingMaterial(false);
    setEditingMaterialId(null);
  };

  const handleEditMaterialInModal = (item) => {
    setIsEditingMaterial(true);
    setEditingMaterialId(item.id);
    setMaterialFormData({
      itemCode: item.item_code || '',
      itemName: item.material_name || '',
      itemGroup: item.material_type || '',
      defaultUom: item.unit || 'Nos',
      valuationRate: item.valuation_rate || 0,
      sellingRate: item.selling_rate || 0,
      noOfCavity: item.no_of_cavity || 1,
      weightPerUnit: item.weight_per_unit || 0,
      weightUom: item.weight_uom || '',
      drawingNo: item.drawing_no || '',
      revision: item.revision || '',
      materialGrade: item.material_grade || ''
    });
  };

  const handleCopyMaterial = (item) => {
    setMaterialFormData(prev => ({
      ...prev,
      itemName: item.material_name || '',
      itemGroup: item.material_type || '',
      defaultUom: item.unit || 'Nos',
      valuationRate: item.valuation_rate || 0,
      sellingRate: item.selling_rate || 0,
      noOfCavity: item.no_of_cavity || 1,
      weightPerUnit: item.weight_per_unit || 0,
      weightUom: item.weight_uom || '',
      // drawingNo and revision are usually kept from the current order context
      materialGrade: item.material_grade || ''
    }));
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Material details copied!',
      showConfirmButton: false,
      timer: 2000
    });
  };

  const handleClearMaterialForm = async () => {
    const nextCode = await fetchNextItemCode();
    setMaterialFormData({
      itemCode: nextCode || '',
      itemName: '',
      itemGroup: '',
      defaultUom: 'Nos',
      valuationRate: 0,
      sellingRate: 0,
      noOfCavity: 1,
      weightPerUnit: 0,
      weightUom: '',
      drawingNo: '',
      revision: '',
      materialGrade: ''
    });
    setIsEditingMaterial(false);
    setEditingMaterialId(null);
  };

  const handleDeleteMaterialInModal = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/stock/items/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete material');

        Swal.fire('Deleted!', 'Material has been deleted.', 'success');
        fetchItemsList(materialFormData.drawingNo);
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleSaveItem = async (itemId) => {
    try {
      setItemSaveLoading(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('drawingNo', editItemData.drawing_no);
      formData.append('revisionNo', editItemData.revision_no);
      if (editItemData.drawing_pdf) {
        formData.append('drawing_pdf', editItemData.drawing_pdf);
      }

      const response = await fetch(`${API_BASE}/drawings/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update item drawing');
      
      Swal.fire('Success', 'Item drawing updated', 'success');
      setEditingItem(null);
      // Refresh details
      handleViewDetails(selectedOrder);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setItemSaveLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/design-orders/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to delete order');
        
        Swal.fire('Deleted!', 'Order has been deleted.', 'success');
        fetchOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.design_order_number?.toLowerCase().includes(searchLower) ||
      order.po_number?.toLowerCase().includes(searchLower) ||
      order.company_name?.toLowerCase().includes(searchLower) ||
      order.project_name?.toLowerCase().includes(searchLower) ||
      order.drawing_no?.toLowerCase().includes(searchLower) ||
      `SO-${String(order.sales_order_id).padStart(4, '0')}`.toLowerCase().includes(searchLower)
    );
  });

  // Group active design tasks by design_order_number to avoid duplicates when multiple items exist
  const uniqueFilteredOrders = Object.values(filteredOrders.reduce((acc, order) => {
    if (!acc[order.id]) {
      acc[order.id] = {
        ...order,
        items: []
      };
    }
    acc[order.id].items.push({
      item_id: order.item_id,
      item_code: order.item_code,
      drawing_no: order.drawing_no,
      total_quantity: order.total_quantity
    });
    return acc;
  }, {}));

  const groupedActive = uniqueFilteredOrders.reduce((acc, order) => {
    const key = order.po_number || 'NO-PO';
    if (!acc[key]) {
      acc[key] = {
        po_number: key,
        company_name: order.company_name,
        orders: []
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {});

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'IN_DESIGN': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="mb-4">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h1 className="text-xl text-slate-900">Design Engineering Hub</h1>
              <p className="text-xs text-slate-600">Review customer drawings and create technical specifications</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { fetchOrders(); fetchIncomingOrders(); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs  hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Refresh
              </button>
            </div>
          </div>

          {/* INFO BANNER */}
         
        </div>

        {/* INCOMING REQUESTS SECTION */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200 mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 border-b border-blue-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm text-white text-thin flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  Incoming Design Requests
                </h2>
              </div>
              {incomingOrders.length > 0 && (
                <span className="px-3 py-1 bg-white text-blue-600 rounded-full text-xs ">
                  {incomingOrders.length}
                </span>
              )}
            </div>
            {selectedIncomingOrders.size > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-blue-400">
                <span className="text-white text-xs ">
                  {selectedIncomingOrders.size} selected
                </span>
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs  hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  Bulk Approve
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-red-500 text-white rounded text-xs  hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  Bulk Reject
                </button>
              </div>
            )}
          </div>
        
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIncomingOrders.size === incomingOrders.length && incomingOrders.length > 0}
                      onChange={toggleSelectAllOrders}
                      className="w-4 h-4 rounded"
                      disabled={incomingOrders.length === 0}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Client Name</th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Item Code</th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Drawing No</th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Description</th>
                  <th className="px-4 py-2 text-center text-xs  text-slate-600 ">Qty</th>
                  <th className="px-4 py-2 text-right text-xs  text-slate-600 ">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {incomingLoading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-600 ">Checking for new requests...</span>
                      </div>
                    </td>
                  </tr>
                ) : incomingOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <p className="text-xs text-slate-500 ">No incoming design requests</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedIncoming).map(([poNumber, group]) => {
                    const isExpanded = expandedIncomingPo[poNumber];
                    const allSelected = group.orders.every(o => selectedIncomingOrders.has(o.id));

                    return (
                      <React.Fragment key={poNumber}>
                        {/* Group Header */}
                        <tr 
                          className={`bg-slate-50/80 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-all ${isExpanded ? 'sticky top-0 z-10' : ''}`} 
                          onClick={() => toggleIncomingPo(poNumber)}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newSelected = new Set(selectedIncomingOrders);
                                group.orders.forEach(o => {
                                  if (e.target.checked) newSelected.add(o.id);
                                  else newSelected.delete(o.id);
                                });
                                setSelectedIncomingOrders(newSelected);
                              }}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-slate-900 text-xs">{group.company_name}</span>
                              <span className="text-[10px] text-slate-500 font-medium">PO: {poNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[10px]">
                                {group.orders.length} {group.orders.length > 1 ? 'Drawings' : 'Drawing'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {group.orders.length === 1 ? (
                              <span className="text-indigo-600 text-[10px]">{group.orders[0].drawing_no || '—'}</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Multiple Drawings Review</span>
                            )}
                          </td>
                          <td>
                            {group.description}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-slate-400 text-[10px]">Total: {group.orders.reduce((sum, o) => sum + (Number(o.item_qty) || 1), 0)}</span>
                          </td>
                          <td className="px-4 py-3 text-right flex gap-2 justify-end">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleAcceptAll(group.orders.map(o => o.id));
                               }}
                               className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm"
                               title="Accept All"
                             >
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                               </svg>
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 toggleIncomingPo(poNumber);
                               }}
                               className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors"
                               title={isExpanded ? 'Hide' : 'Show'}
                             >
                               {isExpanded ? (
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                 </svg>
                               ) : (
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                 </svg>
                               )}
                             </button>
                          </td>
                        </tr>
                        {/* Group Items */}
                        {isExpanded && group.orders.map((order) => (
                          <tr key={`${order.id}-${order.item_id}`} className={`transition-colors text-[11px] border-b border-slate-50 bg-white/50 ${selectedIncomingOrders.has(order.id) ? 'bg-blue-50' : 'hover:bg-blue-50/20'}`}>
                            <td className="px-4 py-2.5 pl-8">
                              <input
                                type="checkbox"
                                checked={selectedIncomingOrders.has(order.id)}
                                onChange={() => toggleSelectOrder(order.id)}
                                className="w-3.5 h-3.5 rounded"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-slate-400"></td>
                            <td className="px-4 py-2.5">
                              {order.item_code ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] ">
                                  {order.item_code}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5  text-indigo-600">{order.drawing_no || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600 italic">
                              {order.item_description || 'No description'}
                            </td>
                            <td className="px-4 py-2.5 text-center text-slate-900">
                              {order.item_qty || 1}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-right flex gap-1 justify-end">
                              <button 
                                onClick={(e) => { e.stopPropagation(); openAddMaterialModal(order); }}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors shadow-sm"
                                title="Add Material"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleViewOrder(order); }}
                                className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 transition-colors"
                                title="View details"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTIVE DESIGN TASKS SECTION */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 border-b border-purple-700">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-sm  text-white flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                     Design Tasks in Progress
                  </h2>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/10 border border-white/20 text-white placeholder-purple-200 text-xs rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                  />
                  <svg className="w-3.5 h-3.5 text-purple-200 absolute right-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
              </div>
              {orders.length > 0 && (
                <span className="px-3 py-1 bg-white text-purple-600 rounded-full text-xs ">
                  {filteredOrders.length} {filteredOrders.length !== orders.length ? `of ${orders.length}` : ''}
                </span>
              )}
            </div>
          </div>
        
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Customer</th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Item Code</th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Drawing No</th>
                  <th className="px-4 py-2 text-center text-xs  text-slate-600 ">Qty</th>
                  <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Status</th>
                  <th className="px-4 py-2 text-right text-xs  text-slate-600 ">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-600 ">Loading design orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <p className="text-xs text-slate-500 ">No tasks match your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedActive).map(([poNumber, group]) => {
                    const isExpanded = expandedActivePo[poNumber];
                    return (
                      <React.Fragment key={poNumber}>
                        {/* Group Header */}
                        <tr 
                          className={`bg-slate-50/80 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-all ${isExpanded ? 'sticky top-0 z-10' : ''}`} 
                          onClick={() => toggleActivePo(poNumber)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                <span className="text-slate-900 text-xs">PO: {poNumber}</span>
                              </div>
                              <span className=" text-indigo-600 text-[10px] ml-5">{group.company_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-lg text-[10px] ">
                              {group.orders.length} Drawing Tasks
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 text-[10px]">
                              {group.orders.length === 1 ? group.orders[0].drawing_no : 'Multiple Drawings Review'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-slate-600  text-xs">{group.orders.reduce((sum, o) => sum + (Number(o.total_quantity) || 0), 0)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 text-[10px] font-medium">
                              {group.orders.some(o => o.status === 'IN_DESIGN') ? 'Work In Progress' : 'Pending Start'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 toggleActivePo(poNumber);
                               }}
                               className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors"
                               title={isExpanded ? 'Hide' : 'Show'}
                             >
                               {isExpanded ? (
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                 </svg>
                               ) : (
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                 </svg>
                               )}
                             </button>
                          </td>
                        </tr>
                        {/* Group Items */}
                        {isExpanded && group.orders.map((order) => (
                          <tr key={`${order.id}-${order.item_id}`} className="hover:bg-purple-50/30 transition-colors text-xs border-b border-slate-50">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 pl-8 font-medium">{order.company_name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {order.item_code ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] ">
                                  {order.item_code}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap  text-indigo-600">{order.drawing_no || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-slate-900">{order.total_quantity || 0}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={order.status}
                                onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                className={`text-xs  rounded px-2 py-1 border-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors ${getStatusColor(order.status)}`}
                              >
                                <option value="DRAFT">Draft</option>
                                <option value="IN_DESIGN">In Design</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <div className="flex justify-end gap-1">
                                <button 
                                  onClick={() => openAddMaterialModal(order)}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors shadow-sm"
                                  title="Add Material"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                                </button>
                                <button 
                                  onClick={() => handleViewDetails(order)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                                  title="View Details"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                </button>
                                <button 
                                  onClick={() => handleDelete(order.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-all"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowDetails(false)}></div>
            <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden transform transition-all">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 border-b border-purple-700">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg  text-white mb-1">
                      Technical Details: PO {selectedOrder?.po_number}
                    </h3>
                    <p className="text-sm text-purple-100">
                      SO-{String(selectedOrder?.sales_order_id).padStart(4, '0')} | {selectedOrder?.company_name} - {selectedOrder?.project_name}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetails(false)}
                    className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {detailsLoading ? (
                  <div className="py-12 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-slate-600  text-xs">Loading technical details...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 bg-white">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Item Code</th>
                          <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Drawing No</th>
                          <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Rev</th>
                          <th className="px-4 py-2 text-left text-xs  text-slate-600 ">Description</th>
                          <th className="px-4 py-2 text-center text-xs  text-slate-600 ">Qty</th>
                          <th className="px-4 py-2 text-right text-xs  text-slate-600 ">PDF / Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {orderDetails.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors text-xs">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{item.item_code}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editingItem?.id === item.id ? (
                                <input 
                                  type="text" 
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-xs"
                                  value={editItemData.drawing_no}
                                  onChange={(e) => setEditItemData({...editItemData, drawing_no: e.target.value})}
                                />
                              ) : (
                                <span className="text-slate-900">{item.drawing_no || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {editingItem?.id === item.id ? (
                                <input 
                                  type="text" 
                                  className="w-12 px-2 py-1 border border-slate-300 rounded text-xs"
                                  value={editItemData.revision_no}
                                  onChange={(e) => setEditItemData({...editItemData, revision_no: e.target.value})}
                                />
                              ) : (
                                <span className="text-slate-600">{item.revision_no || '—'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{item.description}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center  text-indigo-600">{parseFloat(item.quantity).toFixed(3)} {item.unit}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {editingItem?.id === item.id ? (
                                <div className="flex flex-col gap-2 items-end">
                                  <input 
                                    type="file" 
                                    accept=".pdf"
                                    className="text-xs"
                                    onChange={(e) => setEditItemData({...editItemData, drawing_pdf: e.target.files[0]})}
                                  />
                                  <div className="space-x-2">
                                    <button 
                                      onClick={() => handleSaveItem(item.id)}
                                      disabled={itemSaveLoading}
                                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs  hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingItem(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs  hover:bg-slate-300 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button 
                                    onClick={() => openAddMaterialModal(item)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                                    title="Add Material"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                                  </button>
                                  {item.drawing_pdf ? (
                                    <button 
                                      onClick={() => window.open(`${API_BASE.replace('/api', '')}/${item.drawing_pdf}`, '_blank')}
                                      className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                                      title="View PDF"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-xs">—</span>
                                  )}
                                  <button 
                                    onClick={() => handleEditItem(item)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                                    title="Edit Drawing Info"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-2border-t border-slate-200 flex justify-end">
                <button 
                  type="button" 
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs  hover:bg-indigo-700 transition-colors"
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && reviewOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 sticky top-0">
              <h2 className="text-lg  text-white">Design Review - {reviewOrder.company_name}</h2>
              <p className="text-indigo-100 text-xs mt-1">Order: {reviewOrder.project_name}</p>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs  text-slate-600 ">Customer</label>
                  <p className="text-sm text-slate-900 text-xs mt-1">{reviewOrder.company_name}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">PO Number</label>
                  <p className="text-sm text-slate-900 text-xs mt-1">{reviewOrder.po_number || '—'}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">Project</label>
                  <p className="text-sm text-slate-900 text-xs mt-1">{reviewOrder.project_name}</p>
                </div>
                <div>
                  <label className="text-xs  text-slate-600 ">Sales Order</label>
                  <p className="text-sm text-slate-900 text-xs mt-1">SO-{String(reviewOrder.id).padStart(4, '0')}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-xs  text-slate-600  block mb-3">Drawing Details</label>
                {reviewLoading ? (
                  <div className="text-center py-4">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : reviewDetails.length > 0 ? (
                  <div className="space-y-3">
                    {reviewDetails.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-slate-500">Drawing No</span>
                            <p className="text-slate-900 text-xs">{item.drawing_no || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Revision</span>
                            <p className="text-slate-900 text-xs">{item.revision_no || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Quantity</span>
                            <p className="text-slate-900 text-xs">{item.quantity || 1} {item.unit || 'NOS'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{item.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No drawing details available</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-between gap-3">
              <button 
                onClick={() => handleRejectDesign(reviewOrder.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs  hover:bg-red-700 transition-colors"
              >
                ✗ Reject & Return
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 bg-slate-300 text-slate-900 rounded-lg text-xs  hover:bg-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleApproveDesign(reviewOrder.id)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs  hover:bg-emerald-700 transition-colors"
                >
                  ✓ Approve & Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddMaterialModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden transform transition-all border border-slate-200">
              <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg  text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-xs">📦</span>
                  {isEditingMaterial ? 'Edit Material / Item' : 'Add New Material / Item'}
                </h3>
                <button 
                  onClick={() => setShowAddMaterialModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleMaterialSubmit} className="p-2 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Row 1 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Item Code *</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                        placeholder="ITM-0001"
                        value={materialFormData.itemCode}
                        onChange={(e) => setMaterialFormData({...materialFormData, itemCode: e.target.value})}
                        required
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const code = await fetchNextItemCode();
                          if (code) setMaterialFormData(prev => ({ ...prev, itemCode: code }));
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px]  transition-all border border-slate-200"
                        title="Generate Next Code"
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Item Name *</label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      placeholder="Enter item name"
                      value={materialFormData.itemName}
                      onChange={(e) => setMaterialFormData({...materialFormData, itemName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Item Group *</label>
                    <select 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      value={materialFormData.itemGroup}
                      onChange={(e) => setMaterialFormData({...materialFormData, itemGroup: e.target.value})}
                      required
                    >
                      <option value="">Select item group</option>
                      <option value="Raw Material">Raw Material</option>
                      <option value="SFG">SFG</option>
                      <option value="FG">FG</option>
                      <option value="Sub Assembly">Sub Assembly</option>
                      <option value="Consumable">Consumable</option>
                    </select>
                  </div>

                  {/* Row 2 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Default UOM *</label>
                    <select 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      value={materialFormData.defaultUom}
                      onChange={(e) => setMaterialFormData({...materialFormData, defaultUom: e.target.value})}
                      required
                    >
                      <option value="Nos">Nos</option>
                      <option value="Kg">Kg</option>
                      <option value="Mtr">Mtr</option>
                      <option value="Set">Set</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Valuation Rate</label>
                    <input 
                      type="number" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      value={materialFormData.valuationRate}
                      onChange={(e) => setMaterialFormData({...materialFormData, valuationRate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Selling Rate</label>
                    <input 
                      type="number" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      value={materialFormData.sellingRate}
                      onChange={(e) => setMaterialFormData({...materialFormData, sellingRate: e.target.value})}
                    />
                  </div>

                  {/* Row 3 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">No. of Cavity (for mould items)</label>
                    <input 
                      type="number" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      value={materialFormData.noOfCavity}
                      onChange={(e) => setMaterialFormData({...materialFormData, noOfCavity: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Weight per Unit</label>
                    <input 
                      type="number" 
                      step="0.001"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      placeholder="0.00"
                      value={materialFormData.weightPerUnit}
                      onChange={(e) => setMaterialFormData({...materialFormData, weightPerUnit: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Weight UOM</label>
                    <select 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      value={materialFormData.weightUom}
                      onChange={(e) => setMaterialFormData({...materialFormData, weightUom: e.target.value})}
                    >
                      <option value="">Select weight UOM</option>
                      <option value="Kg">Kg</option>
                      <option value="Gm">Gm</option>
                    </select>
                  </div>

                  {/* Row 4 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Drawing No (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      placeholder="Enter drawing number"
                      value={materialFormData.drawingNo}
                      onChange={(e) => setMaterialFormData({...materialFormData, drawingNo: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Revision (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      placeholder="Enter revision"
                      value={materialFormData.revision}
                      onChange={(e) => setMaterialFormData({...materialFormData, revision: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px]  text-slate-500  tracking-wider">Material Grade (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      placeholder="Enter material grade"
                      value={materialFormData.materialGrade}
                      onChange={(e) => setMaterialFormData({...materialFormData, materialGrade: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button 
                      type="button"
                      onClick={handleClearMaterialForm}
                      className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs  hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      Clear Form
                    </button>
                    <button 
                      type="button"
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                    >
                      Generate EAN Barcode
                    </button>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      type="button"
                      onClick={() => setShowAddMaterialModal(false)}
                      className="flex-1 md:flex-none px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs  hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmittingMaterial}
                      className="flex-1 md:flex-none px-10 py-2.5 bg-emerald-600 text-white rounded-xl text-xs  hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      {isSubmittingMaterial ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {isEditingMaterial ? 'Updating...' : 'Saving...'}
                        </>
                      ) : (isEditingMaterial ? 'Update Material' : 'Save Material')}
                    </button>
                  </div>
                </div>
              </form>

              {/* Items List Section */}
              <div className="px-8 pb-8">
                <div className="border-t border-slate-100 pt-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h4 className="text-sm  text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      {materialFormData.drawingNo ? `Materials for Drawing: ${materialFormData.drawingNo}` : 'Recently Added Materials'}
                    </h4>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <input
                          type="text"
                          placeholder="Search items or drawing..."
                          className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={modalSearchTerm}
                          onChange={(e) => setModalSearchTerm(e.target.value)}
                        />
                        <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      {materialFormData.drawingNo && (
                        <button
                          type="button"
                          onClick={() => setModalSearchTerm(materialFormData.drawingNo)}
                          className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px]  hover:bg-blue-100 transition-all whitespace-nowrap"
                        >
                          This Drawing
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200">Item Code</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200">Material Name</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200">Group</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200">UOM</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200 text-center">Selling Rate</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200 text-center">Weight/Unit</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200">Drawing No</th>
                            <th className="px-4 py-3 text-[10px]  text-slate-500  tracking-wider border-b border-slate-200 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemsLoading ? (
                            <tr>
                              <td colSpan="8" className="px-4 py-8 text-center text-slate-400 text-xs italic">
                                Loading materials...
                              </td>
                            </tr>
                          ) : itemsList.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="px-4 py-8 text-center text-slate-400 text-xs italic">
                                No materials found
                              </td>
                            </tr>
                          ) : (
                            [...itemsList]
                              .filter(item => {
                                const search = modalSearchTerm.toLowerCase();
                                return (
                                  item.item_code?.toLowerCase().includes(search) ||
                                  item.material_name?.toLowerCase().includes(search) ||
                                  item.drawing_no?.toLowerCase().includes(search)
                                );
                              })
                              .sort((a, b) => b.id - a.id)
                              .map((item) => {
                                const isCurrentDrawing = materialFormData.drawingNo && item.drawing_no === materialFormData.drawingNo;
                                return (
                                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isCurrentDrawing ? 'bg-emerald-50/40' : ''}`}>
                                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                                      {item.item_code}
                                      {isCurrentDrawing && <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[8px]  ">Current Drg</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600">{item.material_name}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600">
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px]">
                                        {item.material_type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600">{item.unit}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600 text-center">₹{item.selling_rate || 0}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600 text-center">{item.weight_per_unit || 0} {item.weight_uom}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600 ">{item.drawing_no || '-'}</td>
                                    <td className="px-4 py-3 text-xs text-right">
                                      <div className="flex justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleCopyMaterial(item)}
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                          title="Copy Details"
                                        >
                                          📋
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleEditMaterialInModal(item)}
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                          title="Edit"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMaterialInModal(item.id)}
                                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignOrders;
