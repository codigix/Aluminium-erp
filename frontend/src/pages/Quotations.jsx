import React, { useState, useEffect, useMemo } from 'react';
import { Card, DataTable, Modal, SearchableSelect } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const rfqStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  EMAIL_RECEIVED: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', badge: 'bg-sky-100 text-sky-700', label: 'Email Received' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Received' },
  REVIEWED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700', label: 'Reviewed' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Closed' },
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const daysValid = (validUntil) => {
  if (!validUntil) return null;
  const today = new Date();
  const valid = new Date(validUntil);
  const diff = Math.ceil((valid - today) / (1000 * 60 * 60 * 24));
  return diff;
};

const Quotations = () => {
  const [activeTab, setActiveTab] = useState('sent');
  const [quotations, setQuotations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All Quotations');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [formData, setFormData] = useState({
    vendorId: '',
    salesOrderId: '',
    validUntil: '',
    notes: '',
    items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
  });
  const [recordData, setRecordData] = useState({
    projectId: '',
    vendorId: '',
    quotationId: '',
    amount: 0,
    validUntil: '',
    items: [],
    notes: '',
    recordFile: null
  });
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    message: '',
    attachPDF: true
  });
  const [editFormData, setEditFormData] = useState({
    vendorId: '',
    validUntil: '',
    items: []
  });

  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [selectedMR, setSelectedMR] = useState('');
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareData, setCompareData] = useState([]);

  useEffect(() => {
    setSelectedQuotes([]);
    setSelectedMR('');
  }, [activeTab, filterStatus]);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const handlePreviewByNo = async (drawingNo) => {
    if (!drawingNo || drawingNo === '—') {
      errorToast('Drawing number not available');
      return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/drawings?search=${encodeURIComponent(drawingNo)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const drawings = await response.json();
            const dwg = drawings.find(d => d.drawing_no === drawingNo);
            if (dwg) {
                setPreviewDrawing(dwg);
                setShowPreviewModal(true);
                return;
            }
        }
        errorToast('Drawing file not found in system');
    } catch (error) {
        console.error(error);
        errorToast('Failed to fetch drawing info');
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchStats();
    fetchVendors();
    fetchSalesOrders();
    fetchMaterialRequests();
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch quotations');
      const data = await response.json();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/stats`, {
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

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/incoming`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSalesOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    }
  };

  const fetchMaterialRequests = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to show relevant MRs for procurement (e.g., DRAFT, APPROVED)
        setMaterialRequests(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching material requests:', error);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, uom: 'NOS', unit_rate: 0 }]
    });
  };

  const handleSalesOrderChange = async (e) => {
    const value = e.target.value;
    
    // Clear items if nothing selected
    if (!value) {
      setFormData(prev => ({ 
        ...prev, 
        salesOrderId: '',
        items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, uom: 'NOS', unit_rate: 0 }]
      }));
      return;
    }

    const token = localStorage.getItem('authToken');

    // Case 1: Material Request Selection (Pre-fixed with MR-)
    if (value.startsWith('MR-')) {
      const mrId = value.split('MR-')[1];
      setFormData(prev => ({ ...prev, salesOrderId: value }));
      
      try {
        const response = await fetch(`${API_BASE}/material-requests/${mrId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const mrData = await response.json();
            const mrItems = (mrData.items || [])
            .filter(item => {
              const type = (item.material_type || '').toUpperCase();
              return !['FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY'].includes(type);
            })
            .map(item => ({
            drawing_no: item.item_code || '—',
            material_name: item.name || item.item_description || '',
            material_type: item.material_type || '',
            design_qty: parseFloat(item.design_qty) || parseFloat(item.quantity) || 0,
            quantity: parseFloat(item.quantity) || parseFloat(item.design_qty) || 0,
            uom: item.uom || 'NOS',
            unit_rate: item.unit_rate || item.rate || 0
          }));

          setFormData(prev => ({
            ...prev,
            items: mrItems.length > 0 ? mrItems : [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, uom: 'NOS', unit_rate: 0 }]
          }));
        }
      } catch (error) {
        console.error('Error fetching material request details:', error);
      }
      return;
    }

    // Case 2: Project Selection (Existing Logic)
    const soId = value;
    const selectedSO = salesOrders.find(so => String(so.id) === String(soId));
    
    let targetDate = '';
    if (selectedSO && selectedSO.target_dispatch_date) {
      targetDate = new Date(selectedSO.target_dispatch_date).toISOString().split('T')[0];
    }

    setFormData(prev => ({ 
      ...prev, 
      salesOrderId: soId,
      validUntil: targetDate || prev.validUntil 
    }));

    try {
      const response = await fetch(`${API_BASE}/material-requirements/project/${soId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const requirements = await response.json();
        const materialItems = requirements
          .filter(req => {
            const type = (req.material_type || '').toUpperCase();
            return !['FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY'].includes(type);
          })
          .map(req => {
            const shortage = parseFloat(req.shortage) || 0;
            const totalRequired = parseFloat(req.total_required) || 0;
            const finalQty = shortage > 0 ? shortage : totalRequired;
            
            return {
              drawing_no: req.drawing_no || '—',
              material_name: req.material_name || '',
              material_type: req.material_type || '',
              design_qty: finalQty,
              quantity: finalQty,
              uom: req.uom || 'NOS',
              unit_rate: parseFloat(req.rate || req.unit_rate) || 0
            };
          });

        setFormData(prev => ({
          ...prev,
          items: materialItems.length > 0 ? materialItems : [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
        }));
      }
    } catch (error) {
      console.error('Error fetching material requirements:', error);
    }
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleRecordProjectChange = (projectId) => {
    setRecordData({
      ...recordData,
      projectId,
      vendorId: '',
      quotationId: '',
      items: [],
      amount: 0,
      notes: '',
      recordFile: null
    });
  };

  const handleRecordVendorChange = async (vendorId) => {
    // Find the quotation for this project/MR and vendor
    const quotation = quotations.find(q => {
      const isVendorMatch = String(q.vendor_id) === String(vendorId);
      const isStatusMatch = ['SENT', 'DRAFT'].includes(q.status);
      
      let isProjectMatch = false;
      if (recordData.projectId.startsWith('MR-')) {
        const mrId = recordData.projectId.split('MR-')[1];
        isProjectMatch = String(q.mr_id) === String(mrId);
      } else {
        isProjectMatch = String(q.sales_order_id) === String(recordData.projectId);
      }
      
      return isVendorMatch && isStatusMatch && isProjectMatch;
    });

    if (quotation) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotations/${quotation.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const detailedQuotation = await response.json();
          const filteredItems = (detailedQuotation.items || []).filter(item => {
            const type = (item.material_type || '').toUpperCase();
            return !['FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY'].includes(type);
          });
          
          setRecordData({
            ...recordData,
            vendorId,
            quotationId: quotation.id,
            items: filteredItems,
            amount: detailedQuotation.total_amount || 0,
            validUntil: detailedQuotation.valid_until ? new Date(detailedQuotation.valid_until).toISOString().split('T')[0] : '',
            notes: `Response to ${quotation.quote_number}`,
            received_pdf_path: detailedQuotation.received_pdf_path
          });
        }
      } catch (error) {
        console.error('Error fetching quotation details:', error);
      }
    } else {
      setRecordData({
        ...recordData,
        vendorId,
        quotationId: '',
        items: [],
        amount: 0,
        notes: ''
      });
    }
  };

  const handleRecordItemChange = (index, field, value) => {
    const newItems = [...recordData.items];
    newItems[index][field] = value;
    
    // Recalculate item amount
    if (field === 'quantity' || field === 'unit_rate' || field === 'design_qty') {
      const qty = parseFloat(newItems[index].quantity) || parseFloat(newItems[index].design_qty) || 0;
      const rate = parseFloat(newItems[index].unit_rate) || 0;
      newItems[index].amount = qty * rate;
      
      // Sync quantity and design_qty to prioritize design_qty
      if (field === 'design_qty') {
        newItems[index].quantity = value;
      }
      if (field === 'quantity' && (newItems[index].design_qty === undefined || newItems[index].design_qty === 0)) {
        newItems[index].design_qty = value;
      }
    }
    
    // Recalculate total amount (subtotal)
    const totalAmount = newItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || parseFloat(item.design_qty) || 0;
      const rate = parseFloat(item.unit_rate) || 0;
      return sum + (qty * rate);
    }, 0);
    
    setRecordData({ 
      ...recordData, 
      items: newItems,
      amount: totalAmount
    });
  };

  const handleRecordFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRecordData({ ...recordData, recordFile: file });

    // Auto-fetch rates from PDF
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_BASE}/quotations/parse-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to parse PDF');

      const parsedItems = await response.json();
      
      // Map parsed items to existing items in recordData
      const updatedItems = recordData.items.map(existingItem => {
        const existingDrawingNo = (existingItem.drawing_no || existingItem.item_code || '').toLowerCase().trim();
        const existingMaterialName = (existingItem.material_name || '').toLowerCase().trim();

        // Try to find a match by material name or drawing no
        const match = parsedItems.find(pi => {
          const piDrawingNo = (pi.drawing_no || '').toLowerCase().trim();
          const piMaterialName = (pi.material_name || '').toLowerCase().trim();

          // Match by Drawing No (Exact or one contains the other)
          const drawingMatch = piDrawingNo && existingDrawingNo && (
            piDrawingNo === existingDrawingNo || 
            piDrawingNo.includes(existingDrawingNo) || 
            existingDrawingNo.includes(piDrawingNo)
          );

          // Match by Material Name
          const materialMatch = piMaterialName && existingMaterialName && (
            piMaterialName.includes(existingMaterialName) || 
            existingMaterialName.includes(piMaterialName)
          );

          return drawingMatch || materialMatch;
        });

        if (match) {
          const newRate = parseFloat(match.unit_rate) || 0;
          const newQty = parseFloat(match.quantity) || parseFloat(existingItem.quantity) || 0;
          const newAmount = parseFloat(match.amount) || (newQty * newRate);
          
          return {
            ...existingItem,
            unit_rate: newRate,
            quantity: newQty,
            uom: match.unit || existingItem.uom || 'NOS',
            amount: newAmount
          };
        }
        return existingItem;
      });

      const totalAmount = updatedItems.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || parseFloat(item.design_qty) || 0;
        const rate = parseFloat(item.unit_rate) || 0;
        return sum + (qty * rate);
      }, 0);

      setRecordData(prev => ({
        ...prev,
        items: updatedItems,
        amount: totalAmount
      }));

      successToast('Rates auto-filled from PDF');
    } catch (error) {
      console.error('PDF parsing error:', error);
    }
  };

  const handleParseReceivedPDF = async () => {
    if (!recordData.quotationId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${recordData.quotationId}/parse-received-pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to parse saved PDF');

      const parsedItems = await response.json();
      
      const updatedItems = recordData.items.map(existingItem => {
        const existingDrawingNo = (existingItem.drawing_no || existingItem.item_code || '').toLowerCase().trim();
        const existingMaterialName = (existingItem.material_name || '').toLowerCase().trim();

        const match = parsedItems.find(pi => {
          const piDrawingNo = (pi.drawing_no || '').toLowerCase().trim();
          const piMaterialName = (pi.material_name || '').toLowerCase().trim();

          const drawingMatch = piDrawingNo && existingDrawingNo && (
            piDrawingNo === existingDrawingNo || 
            piDrawingNo.includes(existingDrawingNo) || 
            existingDrawingNo.includes(piDrawingNo)
          );

          const materialMatch = piMaterialName && existingMaterialName && (
            piMaterialName.includes(existingMaterialName) || 
            existingMaterialName.includes(piMaterialName)
          );

          return drawingMatch || materialMatch;
        });

        if (match) {
          const newRate = parseFloat(match.unit_rate) || 0;
          const newQty = parseFloat(match.quantity) || parseFloat(existingItem.quantity) || 0;
          const newAmount = parseFloat(match.amount) || (newQty * newRate);
          
          return {
            ...existingItem,
            unit_rate: newRate,
            quantity: newQty,
            uom: match.unit || existingItem.uom || 'NOS',
            amount: newAmount
          };
        }
        return existingItem;
      });

      const totalAmount = updatedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      
      setRecordData(prev => ({ 
        ...prev, 
        items: updatedItems,
        amount: totalAmount
      }));
      successToast('Data auto-filled from saved PDF');
    } catch (error) {
      errorToast(error.message || 'Failed to parse saved PDF');
    }
  };

  const handleRecordAddEmptyItem = () => {
    setRecordData({
      ...recordData,
      items: [...recordData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, uom: 'NOS', unit_rate: 0 }]
    });
  };

  const handleRecordRemoveItem = (index) => {
    const newItems = recordData.items.filter((_, i) => i !== index);
    const totalAmount = newItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || parseFloat(item.design_qty) || 0;
      const rate = parseFloat(item.unit_rate) || 0;
      return sum + (qty * rate);
    }, 0);
    setRecordData({
      ...recordData,
      items: newItems,
      amount: totalAmount
    });
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();

    if (!formData.vendorId) {
      errorToast('Vendor is required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const payload = {
        ...formData,
        vendorId: parseInt(formData.vendorId),
        validUntil: formData.validUntil || null
      };

      // Handle MR vs Sales Order
      if (formData.salesOrderId && String(formData.salesOrderId).startsWith('MR-')) {
        payload.mrId = parseInt(formData.salesOrderId.split('MR-')[1]);
        payload.salesOrderId = null;
      } else {
        payload.salesOrderId = formData.salesOrderId ? parseInt(formData.salesOrderId) : null;
        payload.mrId = null;
      }

      const response = await fetch(`${API_BASE}/quotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to create quotation');

      const result = await response.json();
      const createdQuotation = result.data;
      const vendor = vendors.find(v => String(v.id) === String(payload.vendorId));

      setShowCreateModal(false);
      setFormData({
        vendorId: '',
        salesOrderId: '',
        validUntil: '',
        notes: '',
        items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
      });

      // Open email modal for the newly created quotation
      if (vendor) {
        setSelectedQuotation(createdQuotation);
        setEmailData({
          to: vendor.email || '',
          subject: `Request for Quotation: ${createdQuotation.quote_number}`,
          message: `Dear ${vendor.vendor_name},\n\nPlease find attached our Request for Quotation ${createdQuotation.quote_number}. We look forward to receiving your best quote.\n\nRegards,\nProcurement Team`,
          attachPDF: true
        });
        setShowEmailModal(true);
      } else {
        successToast('Quotation created successfully');
        fetchQuotations();
        fetchStats();
      }
    } catch (error) {
      errorToast(error.message || 'Failed to create quotation');
    }
  };

  const handleRecordQuote = async (e) => {
    e.preventDefault();

    if (!recordData.quotationId) {
      errorToast('Select a project and vendor to identify the quotation');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      // 1. Update text fields and items
      const response = await fetch(`${API_BASE}/quotations/${recordData.quotationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validUntil: recordData.validUntil || null,
          items: recordData.items,
          notes: recordData.notes
        })
      });

      if (!response.ok) throw new Error('Failed to record quote details');

      // 2. Upload file if present
      if (recordData.recordFile) {
        const fileFormData = new FormData();
        fileFormData.append('pdf', recordData.recordFile);
        
        const uploadRes = await fetch(`${API_BASE}/quotations/${recordData.quotationId}/upload-response`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: fileFormData
        });
        
        if (!uploadRes.ok) throw new Error('Failed to upload vendor PDF');
      } else {
        // If no file, manually update status to RECEIVED (upload endpoint does this automatically if file present)
        await fetch(`${API_BASE}/quotations/${recordData.quotationId}/status`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'RECEIVED' })
        });
      }

      successToast('Quote details recorded successfully');
      setShowCreateModal(false);
      setRecordData({ projectId: '', vendorId: '', quotationId: '', amount: 0, validUntil: '', items: [], notes: '', recordFile: null });
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to record quote');
    }
  };

  const handleViewPDF = async (quotationId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      errorToast('Could not view PDF');
      console.error(error);
    }
  };

  const handleViewReceivedPDF = async (quotationId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/received-pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch received PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      errorToast('Could not view vendor PDF');
      console.error(error);
    }
  };

  const handleApproveQuote = async (quotationId) => {
    const result = await Swal.fire({
      title: 'Approve Quote?',
      text: 'This will enable PO creation for this quotation',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'REVIEWED' })
      });

      if (!response.ok) throw new Error('Failed to approve quote');

      successToast('Quote approved successfully');
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to approve quote');
    }
  };

  const handleDeleteQuotation = async (quotationId) => {
    const result = await Swal.fire({
      title: 'Delete Quotation?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete quotation');
      }

      successToast('Quotation deleted successfully');
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete quotation');
    }
  };

  const handleCompare = async () => {
    if (selectedQuotes.length < 2) {
      errorToast('Select at least 2 quotes to compare');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const fetchDetails = selectedQuotes.map(id => 
        fetch(`${API_BASE}/quotations/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      );

      const detailedQuotes = await Promise.all(fetchDetails);
      setCompareData(detailedQuotes);
      setShowCompareModal(true);
    } catch (error) {
      console.error('Error fetching compare data:', error);
      errorToast('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const openEmailModal = (quotation) => {
    const vendor = vendors.find(v => v.id === quotation.vendor_id);
    setSelectedQuotation(quotation);
    setEmailData({
      to: vendor?.email || '',
      subject: `Quotation Request - ${quotation.quote_number}`,
      message: `Dear ${vendor?.vendor_name},\n\nPlease find the attached quotation request.\n\nBest regards`,
      attachPDF: true
    });
    setShowEmailModal(true);
  };

  const openRecordModal = (q) => {
    const projectId = q.mr_id ? `MR-${q.mr_id}` : (q.sales_order_id ? String(q.sales_order_id) : '');
    
    setRecordData({
      projectId: projectId,
      vendorId: String(q.vendor_id),
      quotationId: q.id,
      amount: q.total_amount || 0,
      validUntil: q.valid_until ? new Date(q.valid_until).toISOString().split('T')[0] : '',
      items: q.items || [],
      notes: q.notes || `Response to ${q.quote_number}`,
      recordFile: null
    });
    setActiveTab('received');
    setShowCreateModal(true);
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();

    if (!emailData.to) {
      errorToast('Recipient email is required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          attachPDF: emailData.attachPDF
        })
      });

      if (!response.ok) throw new Error('Failed to send email');

      await fetch(`${API_BASE}/quotations/${selectedQuotation.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'SENT' })
      });

      successToast('Email sent to vendor successfully');
      setShowEmailModal(false);
      setEmailData({ to: '', subject: '', message: '', attachPDF: true });
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to send email');
    }
  };

  const openEditModal = (quotation) => {
    setSelectedQuotation(quotation);
    // Map backend item fields to frontend BOM fields
    const mappedItems = (quotation.items || []).map(item => ({
      drawing_no: item.item_code || '',
      material_name: item.material_name || '',
      material_type: item.material_type || '',
      quantity: item.quantity || 0,
      uom: item.unit || 'NOS',
      unit_rate: item.unit_rate || 0
    }));

    setEditFormData({
      vendorId: quotation.vendor_id,
      validUntil: quotation.valid_until ? new Date(quotation.valid_until).toISOString().split('T')[0] : '',
      items: mappedItems.length > 0 ? mappedItems : [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
    });
    setShowEditModal(true);
  };

  const handleEditQuotation = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: parseInt(editFormData.vendorId),
          validUntil: editFormData.validUntil,
          items: editFormData.items
        })
      });

      if (!response.ok) throw new Error('Failed to update quotation');

      successToast('Quotation updated successfully');
      setShowEditModal(false);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update quotation');
    }
  };

  const displayQuotations = useMemo(() => {
    return quotations.filter(q => {
      const isTabMatch = activeTab === 'sent' 
        ? true 
        : ['RECEIVED', 'REVIEWED', 'PENDING', 'EMAIL_RECEIVED'].includes(q.status);
      const matchesStatus = filterStatus === 'All Quotations' || q.status === filterStatus;
      return isTabMatch && matchesStatus;
    });
  }, [quotations, activeTab, filterStatus]);

  const getVendorName = (vendorId) => {
    return vendors.find(v => v.id === vendorId)?.vendor_name || 'Unknown Vendor';
  };

  const columns = useMemo(() => {
    const baseCols = [
      {
        key: 'quote_number',
        label: 'Quote No.',
        sortable: true,
        render: (val, q) => (
          <div className="font-medium text-slate-900">
            <div className="text-sm  tracking-tight">{val}</div>
            {q.sales_order_id && (
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded ">SO-{q.sales_order_id}</span>
                {q.project_name && <span className="truncate max-w-[120px]">{q.project_name}</span>}
              </div>
            )}
          </div>
        )
      },
      {
        key: 'vendor_id',
        label: 'Vendor',
        sortable: true,
        render: (val) => (
          <div className="flex flex-col">
            <span className="text-slate-900 ">{getVendorName(val)}</span>
            <span className="text-[10px] text-slate-400  tracking-wider font-medium">Vendor ID: #{val}</span>
          </div>
        )
      },
      {
        key: activeTab === 'sent' ? 'valid_until' : 'grand_total',
        label: activeTab === 'sent' ? 'Valid Until' : 'Total Amount',
        sortable: true,
        render: (val, _) => activeTab === 'sent' ? (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-slate-700">{formatDate(val)}</span>
            {val && daysValid(val) > 0 && (
              <span className="text-[9px]  px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 w-fit">
                {daysValid(val)} days left
              </span>
            )}
            {val && daysValid(val) <= 0 && (
              <span className="text-[9px]  px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 w-fit">
                Expired
              </span>
            )}
          </div>
        ) : (
          <div className=" text-indigo-600 text-sm">{formatCurrency(val)}</div>
        )
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (val) => (
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px]  tracking-wider border ${rfqStatusColors[val]?.badge}`}>
            {rfqStatusColors[val]?.label?.toUpperCase() || val}
          </span>
        )
      },
      {
        key: 'actions',
        label: 'Actions',
        className: 'text-right',
        render: (_, q) => (
          <div className="flex justify-end gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleViewPDF(q.id); }}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
              title="View RFQ PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            {q.received_pdf_path && (
              <button
                onClick={(e) => { e.stopPropagation(); handleViewReceivedPDF(q.id); }}
                className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all border border-transparent hover:border-cyan-100"
                title="View Vendor PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            {activeTab === 'sent' && (
              <>
                {['DRAFT', 'SENT', 'EMAIL_RECEIVED'].includes(q.status) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEmailModal(q); }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                    title={q.status === 'SENT' ? 'Resend RFQ' : 'Send RFQ'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
                {['SENT', 'EMAIL_RECEIVED'].includes(q.status) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openRecordModal(q); }}
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all border border-transparent hover:border-cyan-100"
                    title="Record Vendor Response"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  </button>
                )}
                {q.status !== 'RECEIVED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-transparent hover:border-amber-100"
                    title="Edit RFQ"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </>
            )}
            {activeTab === 'received' && q.status === 'RECEIVED' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleApproveQuote(q.id); }}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100"
                title="Approve Quote"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteQuotation(q.id); }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )
      }
    ];

    if (activeTab === 'received') {
      return [
        {
          key: 'selection',
          label: (
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              checked={selectedQuotes.length === displayQuotations.length && displayQuotations.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedQuotes(displayQuotations.map(q => q.id));
                } else {
                  setSelectedQuotes([]);
                }
              }}
            />
          ),
          render: (_, q) => (
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              checked={selectedQuotes.includes(q.id)}
              onChange={(e) => {
                e.stopPropagation();
                if (e.target.checked) {
                  setSelectedQuotes(prev => [...prev, q.id]);
                } else {
                  setSelectedQuotes(prev => prev.filter(id => id !== q.id));
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )
        },
        ...baseCols
      ];
    }

    return baseCols;
  }, [activeTab, selectedQuotes, displayQuotations, vendors, quotations, getVendorName, handleApproveQuote, handleDeleteQuotation, openEmailModal]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              <span>Buying</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              <span>Procurement</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Vendor Quotations</h1>
            <p className="text-xs text-slate-500 font-medium">Manage and compare vendor quotes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQuotations()}
            className="p-2.5 text-slate-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-slate-200 shadow-sm active:scale-95 bg-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {activeTab === 'sent' ? 'Request Quote' : 'Record Quote'}
          </button>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex gap-2 p-1 bg-slate-50 rounded-xl w-fit border border-slate-100">
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-6 py-2 rounded-lg text-sm  transition ${
              activeTab === 'sent'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sent Requests (RFQ)
          </button>
          
          <button
            onClick={() => setActiveTab('received')}
            className={`px-6 py-2 rounded-lg text-sm  transition-all ${
              activeTab === 'received'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Received Quotes
          </button>
        </div>

        {activeTab === 'received' && (
          <div className="flex items-center gap-3">
            <div className="w-64">
              <SearchableSelect
                options={materialRequests.map(mr => ({
                  label: mr.mr_number,
                  value: mr.id,
                  sub: mr.department
                }))}
                value={selectedMR}
                onChange={(e) => {
                  const mrId = e.target.value;
                  setSelectedMR(mrId);
                  if (mrId) {
                    const related = displayQuotations.filter(q => String(q.mr_id) === String(mrId) && q.status === 'RECEIVED');
                    setSelectedQuotes(related.map(q => q.id));
                  } else {
                    setSelectedQuotes([]);
                  }
                }}
                placeholder="Filter by MR to compare"
                labelField="label"
                valueField="value"
                subLabelField="sub"
              />
            </div>
            <button
              onClick={handleCompare}
              disabled={selectedQuotes.length < 2}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedQuotes.length >= 2
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Compare Quotes {selectedQuotes.length > 0 && `(${selectedQuotes.length})`}
            </button>
          </div>
        )}
      </div>

      <DataTable 
        columns={columns}
        data={displayQuotations}
        loading={loading}
        searchPlaceholder="Search quote number, vendor..."
        actions={
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm  focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="All Quotations">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="RECEIVED">Received</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="PENDING">Pending</option>
              <option value="CLOSED">Closed</option>
            </select>
            <button className="p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Quotations', value: stats.total_quotations, sub: `Total: ${formatCurrency(stats.total_value)}`, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
            { label: 'Pending Quotes', value: stats.pending_quotations, sub: 'Awaiting response', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
            { label: 'Approved Quotes', value: stats.approved_quotations, sub: 'Ready for PO', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            { label: 'Received', value: stats.received_quotations || (stats.total_quotations - stats.pending_quotations), sub: 'Vendor responses', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
          ].map((stat, idx) => (
            <div key={idx} className={`${stat.bg} border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
              {stat.bg !== 'bg-white' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <p className={`text-[10px] font-bold ${stat.bg === 'bg-white' ? 'text-slate-400' : 'text-blue-100'} uppercase tracking-wider`}>{stat.label}</p>
                  <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded-xl shadow-sm`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
                  </div>
                </div>
                <p className={`text-2xl font-black ${stat.text} tracking-tight`}>{stat.value || 0}</p>
                <p className={`text-[10px] ${stat.subText} mt-1 font-medium`}>{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
               <h3 className="text-md text-slate-900 text-xs">
                  {activeTab === 'sent' ? 'Create Quote Request (RFQ)' : 'Record Vendor Quote'}
                </h3>
                {activeTab !== 'sent' && (
                  <p className="text-xs text-slate-500 mt-1">Record details from vendor response</p>
                )}
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={activeTab === 'sent' ? handleCreateQuotation : handleRecordQuote} className="">
              {activeTab === 'sent' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Project (Optional)</label>
                      <select
                        value={formData.salesOrderId}
                        onChange={handleSalesOrderChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Project/MR to Load Requirements</option>
                        
                        {salesOrders.length > 0 && (
                          <optgroup label="Projects (Sales Orders)">
                            {salesOrders.map(so => (
                              <option key={so.id} value={so.id}>{so.project_name || `SO-${so.id}`}</option>
                            ))}
                          </optgroup>
                        )}

                        {materialRequests.length > 0 && (
                          <optgroup label="Material Requests">
                            {materialRequests.map(mr => (
                              <option key={`mr-${mr.id}`} value={`MR-${mr.id}`}>
                                {mr.mr_number} ({mr.department || 'No Dept'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
                      <select
                        value={formData.vendorId}
                        onChange={(e) => setFormData({...formData, vendorId: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">-- Select a Vendor --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-slate-700">Line Items</label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700"
                      >
                        + Add Item
                      </button>
                    </div>

                    {formData.items.length === 0 ? (
                      <p className="text-xs text-slate-500 p-4 text-center border border-dashed border-slate-200 rounded">
                        No items added yet. Click "Add Item" to include line items in this quotation.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-[10px]  text-slate-500  tracking-wider">
                          <div className="col-span-2">Drawing No</div>
                          <div className="col-span-3">Material Name</div>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-1 text-center">Design Qty</div>
                          <div className="col-span-2 text-center">Rate (₹)</div>
                          <div className="col-span-1 text-right">Amount</div>
                          <div className="col-span-1"></div>
                        </div>
                        {formData.items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-2 relative">
                              <input
                                type="text"
                                placeholder="Drawing No"
                                value={item.drawing_no}
                                onChange={(e) => handleItemChange(idx, 'drawing_no', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 pr-7"
                              />
                              {item.drawing_no && (
                                <button
                                  type="button"
                                  onClick={() => handlePreviewByNo(item.drawing_no)}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                  title="Preview Drawing"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Material Name"
                              value={item.material_name}
                              onChange={(e) => handleItemChange(idx, 'material_name', e.target.value)}
                              className="col-span-3 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Type"
                              value={item.material_type}
                              onChange={(e) => handleItemChange(idx, 'material_type', e.target.value)}
                              className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              placeholder="Design Qty"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="col-span-1 px-2 py-1.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              placeholder="Rate"
                              value={item.unit_rate}
                              onChange={(e) => handleItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                              className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="col-span-1 text-right text-xs font-medium text-slate-700">
                              {formatCurrency((item.quantity || 0) * (item.unit_rate || 0))}
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Add any notes"
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>

                  {/* Summary Section for Request Quote */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_rate || 0)), 0))}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>GST (18%):</span>
                        <span>{formatCurrency(formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_rate || 0)), 0) * 0.18)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span>{formatCurrency(formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_rate || 0)), 0) * 1.18)}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Select Project/MR</label>
                      <select
                        value={recordData.projectId}
                        onChange={(e) => handleRecordProjectChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select Project/MR to Filter Quotes --</option>
                        
                        {salesOrders.length > 0 && (
                          <optgroup label="Projects (Sales Orders)">
                            {salesOrders.map(so => (
                              <option key={so.id} value={so.id}>{so.project_name || `SO-${so.id}`}</option>
                            ))}
                          </optgroup>
                        )}

                        {materialRequests.length > 0 && (
                          <optgroup label="Material Requests">
                            {materialRequests.map(mr => (
                              <option key={`mr-rec-${mr.id}`} value={`MR-${mr.id}`}>
                                {mr.mr_number} ({mr.department || 'No Dept'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
                      <select
                        value={recordData.vendorId}
                        onChange={(e) => handleRecordVendorChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={!recordData.projectId}
                      >
                        <option value="">-- Select a Vendor --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <label className="block text-[9px]  text-slate-500  tracking-wider mb-1 uppercase font-bold">Subtotal</label>
                        <div className="text-sm font-bold text-slate-700">{formatCurrency(recordData.amount)}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <label className="block text-[9px]  text-slate-500  tracking-wider mb-1 uppercase font-bold">GST (18%)</label>
                        <div className="text-sm font-bold text-slate-700">{formatCurrency(recordData.amount * 0.18)}</div>
                        </div>
                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                        <label className="block text-[9px]  text-blue-500  tracking-wider mb-1 uppercase font-bold">Total</label>
                        <div className="text-base font-black text-blue-900">{formatCurrency(recordData.amount * 1.18)}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                        <label className="block text-[10px] font-medium text-slate-700 mb-1">Valid Until</label>
                        <input
                            type="date"
                            value={recordData.validUntil}
                            onChange={(e) => setRecordData({...recordData, validUntil: e.target.value})}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        </div>
                        <div>
                        <label className="block text-[10px] font-medium text-slate-700 mb-1">Attach Vendor PDF</label>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleRecordFileChange}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-4">
                        <label className="block text-sm font-medium text-slate-700">Line Items</label>
                        {recordData.received_pdf_path && (
                          <button
                            type="button"
                            onClick={handleParseReceivedPDF}
                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-all"
                            title="Extract rates and quantities from the PDF received via email"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Auto-fill from Email PDF
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleRecordAddEmptyItem}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700"
                      >
                        + Add Item
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2  text-slate-600" style={{ width: '150px' }}>DRAWING NO</th>
                            <th className="px-3 py-2  text-slate-600">MATERIAL NAME</th>
                            <th className="px-3 py-2  text-slate-600" style={{ width: '120px' }}>TYPE</th>
                            <th className="px-3 py-2 text-center  text-slate-600" style={{ width: '90px' }}>DESIGN QTY</th>
                            <th className="px-3 py-2 text-center  text-slate-600" style={{ width: '120px' }}>RATE (₹)</th>
                            <th className="px-3 py-2 text-right  text-slate-600" style={{ width: '120px' }}>AMOUNT</th>
                            <th className="px-3 py-2 text-center" style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recordData.items.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="px-3 py-8 text-center text-slate-400">
                                Select a project and vendor to load items, or add manually.
                              </td>
                            </tr>
                          ) : (
                            recordData.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={item.drawing_no || item.item_code || ''}
                                      onChange={(e) => handleRecordItemChange(idx, 'drawing_no', e.target.value)}
                                      className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all pr-7"
                                      placeholder="Drawing..."
                                    />
                                    {(item.drawing_no || item.item_code) && (
                                      <button
                                        type="button"
                                        onClick={() => handlePreviewByNo(item.drawing_no || item.item_code)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                        title="Preview Drawing"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.material_name}
                                    onChange={(e) => handleRecordItemChange(idx, 'material_name', e.target.value)}
                                    className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                    placeholder="Material..."
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.material_type}
                                    onChange={(e) => handleRecordItemChange(idx, 'material_type', e.target.value)}
                                    className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                    placeholder="Type..."
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.design_qty || item.quantity || 0}
                                    onChange={(e) => handleRecordItemChange(idx, 'design_qty', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-center outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                    placeholder="0.000"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.unit_rate}
                                    onChange={(e) => handleRecordItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-center outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-slate-700">
                                  {formatCurrency((parseFloat(item.quantity) || parseFloat(item.design_qty) || 0) * (parseFloat(item.unit_rate) || 0))}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRecordRemoveItem(idx)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    ✕
                                  </button>
                                </td>
                             </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {recordData.items.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg flex flex-col gap-2 border border-blue-100">
                        <div className="flex justify-between items-center text-xs text-blue-600">
                          <span>Subtotal</span>
                          <span>{formatCurrency(recordData.amount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-emerald-600 font-bold border-t border-blue-100 pt-2">
                          <span>GST (18%)</span>
                          <span>+ {formatCurrency(recordData.amount * 0.18)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t-2 border-blue-200 pt-2">
                          <span className="text-sm font-black text-blue-800 uppercase tracking-wider">Grand Total</span>
                          <span className="text-2xl font-black text-blue-900">{formatCurrency(recordData.amount * 1.18)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={recordData.notes}
                      onChange={(e) => setRecordData({...recordData, notes: e.target.value})}
                      placeholder="Add any notes from vendor response"
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                >
                  Create Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmailModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Send Quotation via Email</h3>
              <button 
                onClick={() => {
                  setShowEmailModal(false);
                  fetchQuotations();
                  fetchStats();
                }} 
                className="text-slate-500 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="attachPDF"
                  checked={emailData.attachPDF}
                  onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="attachPDF" className="text-sm text-slate-700">Attach Quotation PDF</label>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailModal(false);
                    fetchQuotations();
                    fetchStats();
                  }}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Send Email
                </button>
              </div>
           </form>
          </div>
        </div>
      )}

      {showEditModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Edit Quotation</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>
            
            <form onSubmit={handleEditQuotation} className="">
              <div className="grid grid-cols-2 gap-4">
                <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                  <select
                    value={editFormData.vendorId}
                    onChange={(e) => setEditFormData({...editFormData, vendorId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.vendor_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={editFormData.validUntil}
                    onChange={(e) => setEditFormData({...editFormData, validUntil: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Line Items</label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData({
                        ...editFormData,
                        items: [...editFormData.items, { drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
                      });
                    }}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700"
                  >
                    + Add Item
                  </button>
                </div>
                {editFormData.items.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center border border-dashed border-slate-200 rounded">
                    No items added yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-[10px]  text-slate-500  tracking-wide">
                      <div className="col-span-2">Drawing No</div>
                      <div className="col-span-3">Material Name</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-1 text-center">Design Qty</div>
                      <div className="col-span-2 text-center">Rate (₹)</div>
                      <div className="col-span-1 text-right">Amount</div>
                      <div className="col-span-1"></div>
                    </div>
                    {editFormData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Drawing No"
                          value={item.drawing_no}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].drawing_no = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Material Name"
                          value={item.material_name}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].material_name = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-3 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Type"
                          value={item.material_type}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].material_type = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Design Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].quantity = parseFloat(e.target.value) || 0;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-1 px-2 py-1.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.unit_rate}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].unit_rate = parseFloat(e.target.value) || 0;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="col-span-1 text-right text-xs font-medium text-slate-700">
                          {formatCurrency((item.quantity || 0) * (item.unit_rate || 0))}
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = editFormData.items.filter((_, i) => i !== idx);
                              setEditFormData({...editFormData, items: newItems});
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Update Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCompareModal && compareData.length > 0 && (
        <Modal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          title="Compare Vendor Quotations"
          size="6xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-3 border text-left text-xs font-bold text-slate-600 sticky left-0 bg-slate-50 z-10">Item / Drawing No.</th>
                  {compareData.map((q, idx) => (
                    <th key={idx} className="p-3 border text-center text-xs font-bold text-slate-800 bg-indigo-50/50" colSpan="2">
                      <div className="flex flex-col gap-1">
                        <span className="text-indigo-600">{getVendorName(q.vendor_id)}</span>
                        <span className="text-[10px] text-slate-500 font-normal">{q.quote_number}</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="p-2 border sticky left-0 bg-slate-50/50 z-10"></th>
                  {compareData.map((_, idx) => (
                    <React.Fragment key={idx}>
                      <th className="p-2 border text-right">Unit Rate</th>
                      <th className="p-2 border text-right">Total</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {/* Collect all unique items */}
                {Array.from(new Set(compareData.flatMap(q => (q.items || []).map(item => item.item_code || item.drawing_no)))).map((itemCode, itemIdx) => {
                  const firstItem = compareData.flatMap(q => q.items || []).find(it => (it.item_code || it.drawing_no) === itemCode);
                  return (
                    <tr key={itemIdx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 border font-medium text-slate-900 sticky left-0 bg-white z-10">
                        <div className="flex flex-col">
                          <span>{itemCode}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{firstItem?.material_name}</span>
                        </div>
                      </td>
                      {compareData.map((q, qIdx) => {
                        const item = (q.items || []).find(it => (it.item_code || it.drawing_no) === itemCode);
                        return (
                          <React.Fragment key={qIdx}>
                            <td className="p-3 border text-right text-slate-600 font-mono">
                              {item ? formatCurrency(item.unit_rate) : '—'}
                            </td>
                            <td className={`p-3 border text-right font-mono ${item ? 'text-indigo-600 font-bold' : 'text-slate-300'}`}>
                              {item ? formatCurrency(item.amount || (item.unit_rate * item.quantity)) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="p-4 border text-right sticky left-0 bg-slate-50 z-10">GRAND TOTAL</td>
                  {compareData.map((q, idx) => (
                    <td key={idx} className="p-4 border text-right text-indigo-700 text-sm" colSpan="2">
                      {formatCurrency(q.total_amount)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 border text-right sticky left-0 bg-white z-10">Actions</td>
                  {compareData.map((q, idx) => (
                    <td key={idx} className="p-4 border text-center" colSpan="2">
                      <button
                        onClick={() => {
                          handleApproveQuote(q.id);
                          setShowCompareModal(false);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        Approve this Quote
                      </button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}

      <DrawingPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default Quotations;

