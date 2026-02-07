import React, { useState, useEffect } from 'react';
import { Card, Modal, DataTable, StatusBadge, FormControl } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Plus, Search, RefreshCw, Filter, FileText, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast, infoToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const CustomerDrawing = () => {
  const [drawings, setDrawings] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadMode, setUploadMode] = useState('bulk'); // 'bulk' or 'manual'
  const [clientLocked, setClientLocked] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const [clientFilter, setClientFilter] = useState('ALL');
  const [lastUploadedDrawings, setLastUploadedDrawings] = useState([]);
  
  // Revisions Modal State
  const [showRevisions, setShowRevisions] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    drawing_no: '',
    revision_no: '',
    description: '',
    drawing_pdf: null
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const requirementColumns = [
    { 
      label: 'Client', 
      key: 'client_name', 
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{val || row.company_name || '—'}</span>
        </div>
      )
    },
    { 
      label: 'Drawing No', 
      key: 'drawing_no', 
      sortable: true,
      render: (val) => (
        <div className="max-w-[250px] max-h-[60px] overflow-y-auto text-[10px] leading-relaxed pr-2 text-slate-500" title={val}>
          {val}
        </div>
      )
    },
    { 
      label: 'Contact', 
      key: 'contact_person',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{row.contact_phone || val || '—'}</span>
          {row.contact_phone && val && val !== row.contact_phone && (
            <span className="text-[10px] text-slate-500">{val}</span>
          )}
        </div>
      )
    },
    { label: 'Email', key: 'email_address' },
    { 
      label: 'Status', 
      key: 'status', 
      render: (val) => <StatusBadge status={val || 'PENDING'} /> 
    },
    { 
      label: 'Date', 
      key: 'created_at', 
      render: (val) => val ? new Date(val).toLocaleDateString() : '—' 
    }
  ];

  // Approved Drawings Modal State
  const [showApprovedDrawings, setShowApprovedDrawings] = useState(false);
  const [approvedGroupedByClient, setApprovedGroupedByClient] = useState({});
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [selectedApprovedClient, setSelectedApprovedClient] = useState(null);
  const [selectedApprovedItems, setSelectedApprovedItems] = useState([]);
  const [quotePrices, setQuotePrices] = useState({});
  const [quotationNotes, setQuotationNotes] = useState('');
  const [creatingQuotation, setCreatingQuotation] = useState(false);

  const fetchDrawings = async (search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const url = search 
        ? `${API_BASE}/drawings?search=${encodeURIComponent(search)}`
        : `${API_BASE}/drawings`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch drawings');
      const data = await response.json();
      setDrawings(data);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load customer drawings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error('Fetch companies error:', error);
    }
  };

  const fetchApprovedDrawings = async () => {
    try {
      setApprovedLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/approved-drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch approved drawings');
      const data = await response.json();

      const grouped = {};
      data.forEach(order => {
        const clientName = order.company_name || 'Unassigned';
        if (!grouped[clientName]) {
          grouped[clientName] = {
            company_name: clientName,
            company_id: order.company_id,
            contact_person: order.contact_person || '',
            email: order.email || '',
            phone: order.phone || '',
            address: order.address || '',
            orders: []
          };
        }
        grouped[clientName].orders.push(order);
      });
      setApprovedGroupedByClient(grouped);
    } catch (error) {
      console.error('Fetch approved drawings error:', error);
      errorToast('Failed to load approved drawings');
    } finally {
      setApprovedLoading(false);
    }
  };

  const handleSelectApprovedClient = (clientName) => {
    const client = approvedGroupedByClient[clientName];
    setSelectedApprovedClient(clientName);
    const items = [];
    client.orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          items.push({
            ...item,
            sales_order_id: order.id,
            po_number: order.po_number,
            po_date: order.po_date,
            po_net_total: order.po_net_total
          });
        });
      }
    });
    setSelectedApprovedItems(items);
    setQuotePrices({});
    setQuotationNotes('');
  };

  const handlePriceChange = (itemId, price) => {
    setQuotePrices(prev => ({
      ...prev,
      [itemId]: parseFloat(price) || 0
    }));
  };

  const calculateQuotationTotal = () => {
    return selectedApprovedItems.reduce((sum, item) => {
      const price = quotePrices[item.id] || 0;
      return sum + price;
    }, 0);
  };

  const handleCreateQuotation = async () => {
    if (!selectedApprovedClient || selectedApprovedItems.length === 0) {
      errorToast('Please select a client and items');
      return;
    }

    const hasPrices = selectedApprovedItems.some(item => quotePrices[item.id] && quotePrices[item.id] > 0);
    if (!hasPrices) {
      errorToast('Please enter quote prices for at least one item');
      return;
    }

    const clientData = approvedGroupedByClient[selectedApprovedClient];
    if (!clientData.email) {
      errorToast('Client email address not available. Cannot create quotation.');
      return;
    }

    const result = await Swal.fire({
      title: 'Create Quotation',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Client:</strong> ${clientData.company_name}</p>
          <p><strong>Items:</strong> ${selectedApprovedItems.length}</p>
          <p><strong>Total Value:</strong> ₹${calculateQuotationTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p style="color: #666; margin-top: 8px;">Quotation will be created and sent to client.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Quotation',
      confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
      try {
        setCreatingQuotation(true);
        const token = localStorage.getItem('authToken');
        
        const quotationData = {
          company_id: clientData.company_id,
          company_name: clientData.company_name,
          contact_person: clientData.contact_person,
          email: clientData.email,
          phone: clientData.phone,
          address: clientData.address,
          items: selectedApprovedItems.map(item => ({
            sales_order_id: item.sales_order_id,
            sales_order_item_id: item.id,
            drawing_no: item.drawing_no,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            quoted_price: quotePrices[item.id] || 0
          })),
          total_amount: calculateQuotationTotal(),
          notes: quotationNotes
        };

        const response = await fetch(`${API_BASE}/quotation-requests`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(quotationData)
        });

        if (!response.ok) throw new Error('Failed to create quotation');
        
        successToast('Quotation created and sent to client');
        setShowApprovedDrawings(false);
        setSelectedApprovedClient(null);
        setSelectedApprovedItems([]);
        setQuotePrices({});
        setQuotationNotes('');
        fetchApprovedDrawings();
      } catch (error) {
        console.error(error);
        errorToast(error.message);
      } finally {
        setCreatingQuotation(false);
      }
    }
  };

  const toggleClientGroup = (clientName) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  const groupedDrawings = drawings.reduce((acc, drawing) => {
    const client = drawing.client_name || 'Unassigned';
    if (clientFilter !== 'ALL' && client !== clientFilter) return acc;
    if (!acc[client]) acc[client] = [];
    acc[client].push(drawing);
    return acc;
  }, {});

  const fetchRequirements = async () => {
    try {
      setReqLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders?includeWithoutPo=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch requirements');
      const data = await response.json();
      const filtered = data.filter(so => so.project_name?.includes('Design Review') || so.current_department === 'DESIGN_ENG');
      setRequirements(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setReqLoading(false);
    }
  };

  useEffect(() => {
    fetchDrawings();
    fetchCompanies();
    fetchRequirements();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clientInput = event.target.closest('.client-input-container');
      if (!clientInput) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDrawings(searchTerm);
  };

  const handleViewRevisions = async (drawing) => {
    try {
      setSelectedDrawing(drawing);
      setShowRevisions(true);
      setRevisionsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${encodeURIComponent(drawing.drawing_no)}/revisions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch revisions');
      const data = await response.json();
      setRevisions(data);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load revisions');
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleEdit = (drawing) => {
    setEditData({
      drawing_no: drawing.drawing_no,
      revision_no: drawing.revision || drawing.revision_no || '0',
      description: drawing.description || '',
      drawing_pdf: null
    });
    setShowEditModal(true);
  };

  const handlePreview = (drawing) => {
    setPreviewDrawing(drawing);
    setShowPreviewModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaveLoading(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('revisionNo', editData.revision_no);
      formData.append('description', editData.description);
      if (editData.drawing_pdf) {
        formData.append('drawing_pdf', editData.drawing_pdf);
      }

      const response = await fetch(`${API_BASE}/drawings/${encodeURIComponent(editData.drawing_no)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update drawing');
      
      successToast('Customer drawing updated successfully');
      setShowEditModal(false);
      fetchDrawings(searchTerm);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // New Form State
  const [newDrawing, setNewDrawing] = useState({
    client_name: '',
    contact_person: '',
    phone_number: '',
    email_address: '',
    customer_type: '',
    gstin: '',
    city: '',
    state: '',
    billing_address: '',
    shipping_address: '',
    drawing_no: '',
    revision: '',
    qty: 1,
    description: '',
    file: null,
    zipFile: null,
    remarks: ''
  });
  const [manualDrawings, setManualDrawings] = useState([
    { id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', file: null, zipFile: null, remarks: '' }
  ]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewDrawing({
        ...newDrawing,
        file: file
      });
    }
  };

  const handleZipFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewDrawing({
        ...newDrawing,
        zipFile: file
      });
    }
  };

  const handleManualDrawingChange = (id, field, value) => {
    setManualDrawings(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addManualDrawingRow = () => {
    setManualDrawings(prev => [
      ...prev,
      { id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', file: null, remarks: '' }
    ]);
  };

  const removeManualDrawingRow = (id) => {
    if (manualDrawings.length > 1) {
      setManualDrawings(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleManualFileChange = (e, id) => {
    const file = e.target.files[0];
    if (file) {
      handleManualDrawingChange(id, 'file', file);
    }
  };

  const handleClientInput = (value) => {
    setNewDrawing({...newDrawing, client_name: value});
    
    if (value.trim()) {
      const filtered = companies.filter(company =>
        company.company_name.toLowerCase().includes(value.toLowerCase())
      );
      setClientSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setClientSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectClient = (company) => {
    const billingAddress = company.addresses?.find(a => a.address_type === 'BILLING');
    const shippingAddress = company.addresses?.find(a => a.address_type === 'SHIPPING');
    const billingAddressLine = billingAddress ? `${billingAddress.line1}${billingAddress.line2 ? ', ' + billingAddress.line2 : ''}, ${billingAddress.city}, ${billingAddress.state} ${billingAddress.pincode}` : '';
    const shippingAddressLine = shippingAddress ? `${shippingAddress.line1}${shippingAddress.line2 ? ', ' + shippingAddress.line2 : ''}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}` : '';
    
    setNewDrawing({
      ...newDrawing,
      client_name: company.company_name,
      contact_person: company.contact_person || '',
      phone_number: company.contact_mobile || '',
      email_address: company.contact_email || '',
      customer_type: company.customer_type || '',
      gstin: company.gstin || '',
      city: billingAddress?.city || '',
      state: billingAddress?.state || '',
      billing_address: billingAddressLine,
      shipping_address: shippingAddressLine
    });
    setShowSuggestions(false);
  };

  const saveSingleDrawing = async (drawingData, sendToDesign = false) => {
    const fileExt = drawingData.file ? drawingData.file.name.split('.').pop().toUpperCase() : '';
    const isExcel = fileExt === 'XLSX' || fileExt === 'XLS';
    
    if (!drawingData.file) {
      warningToast('Drawing File is mandatory');
      return null;
    }
    
    if (!isExcel && !drawingData.drawing_no) {
      warningToast('Drawing Number is mandatory');
      return null;
    }

    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('clientName', newDrawing.client_name);
      formData.append('contactPerson', newDrawing.contact_person);
      formData.append('phoneNumber', newDrawing.phone_number);
      formData.append('emailAddress', newDrawing.email_address);
      formData.append('customerType', newDrawing.customer_type);
      formData.append('gstin', newDrawing.gstin);
      formData.append('city', newDrawing.city);
      formData.append('state', newDrawing.state);
      formData.append('billingAddress', newDrawing.billing_address);
      formData.append('shippingAddress', newDrawing.shipping_address);
      
      formData.append('drawingNo', drawingData.drawing_no || (drawingData.file ? drawingData.file.name : 'BATCH_IMPORT'));
      formData.append('revision', drawingData.revision || '');
      formData.append('qty', drawingData.qty || 1);
      formData.append('description', drawingData.description || '');
      formData.append('remarks', drawingData.remarks || '');
      formData.append('fileType', fileExt);
      formData.append('file', drawingData.file);
      if (newDrawing.zipFile) {
        formData.append('zipFile', newDrawing.zipFile);
      }

      const response = await fetch(`${API_BASE}/drawings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
      }
      
      const savedDrawing = await response.json();
      const drawingId = savedDrawing.id || savedDrawing.drawing_id;
      const isExcelUpload = isExcel && savedDrawing.count;

      if (sendToDesign && drawingId) {
        await shareDrawingWithDesign(drawingId);
      } else if (isExcelUpload && sendToDesign) {
        await sendBulkUploadedToDesign(newDrawing.client_name, savedDrawing.count);
      }
      
      return { drawingId, isExcelUpload, count: savedDrawing.count };
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleAddDrawing = async (e) => {
    e.preventDefault();
    if (!newDrawing.client_name) {
      return warningToast('Client Name is mandatory');
    }

    try {
      setLoading(true);
      if (uploadMode === 'bulk') {
        if (!newDrawing.file) return warningToast('Excel File is mandatory');
        const result = await saveSingleDrawing(newDrawing, false);
        if (result) {
          successToast(result.isExcelUpload ? `${result.count} Excel drawings imported successfully` : 'Drawing added successfully');
          setNewDrawing({
            client_name: '', contact_person: '', phone_number: '', email_address: '', customer_type: '', gstin: '', city: '', state: '', billing_address: '', shipping_address: '', drawing_no: '', revision: '', qty: 1, description: '', file: null, zipFile: null, remarks: ''
          });
          setLastUploadedDrawings({ clientName: newDrawing.client_name, count: result.count, timestamp: Date.now() });
        }
      } else {
        let successCount = 0;
        for (const drawing of manualDrawings) {
          if (!drawing.drawing_no || !drawing.file) continue;
          await saveSingleDrawing(drawing, false);
          successCount++;
        }
        
        if (successCount > 0) {
          successToast(`${successCount} drawings added successfully`);
          setManualDrawings([{ id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', file: null, remarks: '' }]);
          setClientLocked(true);
        } else {
          warningToast('No drawings were added. Please fill in Drawing # and select a file for at least one row.');
        }
      }
      fetchDrawings();
      fetchRequirements();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const shareDrawingsBulkAPI = async (ids) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/drawings/share/bulk`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Bulk share failed');
    }
    return response.json();
  };

  const sendBulkUploadedToDesign = async (clientName, count) => {
    try {
      const token = localStorage.getItem('authToken');
      const allDrawings = await fetch(`${API_BASE}/drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());

      const clientDrawings = allDrawings.filter(d => d.client_name === clientName && (!d.status || d.status !== 'SHARED'));
      const recentDrawings = clientDrawings.slice(0, count); // Get the most recent unshared drawings

      if (recentDrawings.length > 0) {
        await shareDrawingsBulkAPI(recentDrawings.map(d => d.id));
        successToast(`All ${recentDrawings.length} imported drawings sent to Design Engineer for review as a single request`);
        setLastUploadedDrawings([]);
        setShowFormModal(false);
        fetchDrawings();
        fetchRequirements();
      }
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    }
  };

  const handleShareClientGroupWithDesign = async (clientName) => {
    const unsharedDrawings = groupedDrawings[clientName].filter(d => !d.status || d.status !== 'SHARED');
    
    if (unsharedDrawings.length === 0) {
      infoToast('All drawings for this client are already shared.');
      return;
    }

    const result = await Swal.fire({
      title: 'Send to Design?',
      text: `Send all ${unsharedDrawings.length} unshared drawings to Design Department for review?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, send all',
      confirmButtonColor: '#10b981',
      width: '350px',
      customClass: {
        title: 'text-lg',
        htmlContainer: 'text-sm',
        confirmButton: 'text-sm',
        cancelButton: 'text-sm'
      }
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await shareDrawingsBulkAPI(unsharedDrawings.map(d => d.id));
        successToast(`All ${unsharedDrawings.length} drawings for ${clientName} sent to Design Engineer as a single request`);
        fetchDrawings();
        fetchRequirements();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const shareDrawingWithDesign = async (drawingId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${drawingId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Share failed');
      
      successToast('Drawing saved and sent to Design Engineer for review and approval');
      fetchDrawings();
      fetchRequirements();
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    }
  };

  const handleAddAndSendToDesign = async (e) => {
    e.preventDefault();
    if (!newDrawing.client_name) {
      return warningToast('Client Name is mandatory');
    }

    try {
      setLoading(true);
      if (uploadMode === 'bulk') {
        const result = await saveSingleDrawing(newDrawing, true);
        if (result) {
          setNewDrawing({
            client_name: '', contact_person: '', phone_number: '', email_address: '', customer_type: '', gstin: '', city: '', state: '', billing_address: '', shipping_address: '', drawing_no: '', revision: '', qty: 1, description: '', file: null, zipFile: null, remarks: ''
          });
          setShowFormModal(false);
        }
      } else {
        let successIds = [];
        for (const drawing of manualDrawings) {
          if (!drawing.drawing_no || !drawing.file) continue;
          const result = await saveSingleDrawing(drawing, false); // Don't share individually
          if (result && result.drawingId) {
            successIds.push(result.drawingId);
          }
        }
        if (successIds.length > 0) {
          await shareDrawingsBulkAPI(successIds);
          successToast(`${successIds.length} drawings added and sent to Design Engineering as a single request`);
          setManualDrawings([{ id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', file: null, remarks: '' }]);
          setClientLocked(true);
          setShowFormModal(false);
        }
      }
      fetchDrawings();
      fetchRequirements();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShareWithDesign = async (id) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Share failed');
      
      successToast('Drawing shared with Engineering Department');
      fetchDrawings(searchTerm);
      fetchRequirements();
    } catch (error) {
      console.error(error);
      errorToast(error.message);
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
        const response = await fetch(`${API_BASE}/drawings/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Delete failed');
        successToast('Drawing has been deleted.');
        fetchDrawings();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const handleDeleteClientGroup = async (clientName) => {
    const clientDrawings = groupedDrawings[clientName];
    const result = await Swal.fire({
      title: 'Delete All Drawings?',
      html: `<p>Remove all <strong>${clientDrawings.length}</strong> drawings for <strong>${clientName}</strong>?</p><p style="color: #ef4444; font-size: 0.875rem; margin-top: 8px;">This action cannot be undone.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete all'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        setLoading(true);
        
        const deletePromises = clientDrawings.map(drawing =>
          fetch(`${API_BASE}/drawings/${drawing.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        );

        const results = await Promise.all(deletePromises);
        const failed = results.filter(r => !r.ok);

        if (failed.length === 0) {
          successToast(`All drawings for ${clientName} have been deleted.`);
          fetchDrawings();
        } else {
          warningToast(`${failed.length} drawings failed to delete.`);
          fetchDrawings();
        }
      } catch (error) {
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3 gap-4">
            <div>
              <h1 className="text-xl text-slate-900">Customer Drawing Master</h1>
              <p className="text-xs text-slate-600">Manage customer reference drawings and technical documentation</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowFormModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs  hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Client Requirement
              </button>
              <button 
                onClick={() => { setShowApprovedDrawings(true); fetchApprovedDrawings(); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs  hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Approved Drawings
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Search drawings, clients..." 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="absolute right-2 top-2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button 
                type="submit"
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs  hover:bg-indigo-700 transition-colors"
              >
                Search
              </button>
              <button 
                type="button"
                onClick={() => { setSearchTerm(''); fetchDrawings(); }}
                className="px-3 py-2 bg-white text-slate-600 rounded-lg text-xs  hover:bg-slate-50 border border-slate-300 transition-colors"
              >
                Reset
              </button>
            </form>
          </div>

          {/* INFO BANNER */}
          <div className="bg-gradient-to-r mt-3 from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs text-amber-900 font-medium ">
              Customer drawings are reference only. Production drawings created by Engineering.
            </p>
          </div>
        </div>

        {/* SECTION 2: CLIENT REQUIREMENTS TABLE */}
        <div className="mb-4">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg  text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Client Requirements
              </h2>
            </div>
            <DataTable 
              columns={requirementColumns}
              data={requirements}
              loading={reqLoading}
            />
          </Card>
        </div>

        {/* SECTION 3: CUSTOMER DRAWINGS TABLE */}
        <div className="mb-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-base text-slate-900 flex items-center gap-2 mb-0.5">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Drawings Database
                </h2>
                <p className="text-xs text-slate-600"><span className="">{drawings.length}</span> drawings | <span className="">{Object.keys(groupedDrawings).length}</span> clients</p>
              </div>
            <div className="flex items-center gap-2">
              <select 
                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs  text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="ALL">👥 All</option>
                {Object.keys(drawings.reduce((acc, d) => {
                  if (d.client_name) acc[d.client_name] = true;
                  return acc;
                }, {})).sort().map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const allExpanded = Object.keys(groupedDrawings).reduce((acc, client) => {
                    acc[client] = true;
                    return acc;
                  }, {});
                  setExpandedClients(allExpanded);
                }}
                className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                title="Expand All"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button 
                onClick={() => setExpandedClients({})}
                className="p-1.5 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors"
                title="Collapse All"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        
          <div className="p-3">
            {loading ? (
              <div className="py-8 text-center">
                <div className="flex justify-center mb-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-600  text-xs">Loading...</p>
              </div>
            ) : Object.keys(groupedDrawings).length === 0 ? (
              <div className="py-8 text-center">
                <svg className="mx-auto w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v12m6-6H6"/></svg>
                <p className="text-slate-500  text-xs">No drawings found</p>
                <p className="text-slate-400 text-xs">Add drawings using the form above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(groupedDrawings).map(([clientName, clientDrawings]) => (
                  <div key={clientName} className="border border-slate-200 rounded bg-white overflow-hidden transition-all hover:shadow-sm">
                    {/* CLIENT GROUP HEADER */}
                    <div 
                      onClick={() => toggleClientGroup(clientName)}
                      className={`px-4 py-2 cursor-pointer flex justify-between items-center transition-all group ${expandedClients[clientName] ? 'bg-indigo-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-1 rounded text-indigo-600 transition-all ${expandedClients[clientName] ? 'rotate-90' : ''}`}>
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-sm text-slate-900">{clientName}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs ">
                          {clientDrawings.length}
                        </span>
                        {clientDrawings.some(d => !d.status || d.status !== 'SHARED') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareClientGroupWithDesign(clientName);
                            }}
                            className="px-2 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded text-[10px]  transition-all flex items-center gap-1"
                            title="Send all unshared drawings to Design"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                            Send to Design
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClientGroup(clientName);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-all"
                        title="Delete all drawings for this client"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>

                    {/* DRAWINGS TABLE (ACCORDION CONTENT) */}
                    {expandedClients[clientName] && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">#</th>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">Drawing</th>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">Description</th>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">Rev</th>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">Qty</th>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">File</th>
                              <th className="px-3 py-2 text-left text-xs  text-slate-600">By</th>
                              <th className="px-3 py-2 text-right text-xs  text-slate-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {clientDrawings.map((drawing, idx) => (
                              <tr key={drawing.id || `${drawing.drawing_no}-${idx}`} className="hover:bg-indigo-50/30 transition-colors text-xs">
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500 ">{idx + 1}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-900">{drawing.drawing_no}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                                  {drawing.description || <span className="text-slate-400 italic">—</span>}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-xs ">
                                    {drawing.revision || drawing.revision_no || '0'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                  <span className=" text-indigo-600">{drawing.qty || 1}</span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {(drawing.file_path || drawing.drawing_pdf) ? (
                                    <button 
                                      onClick={() => handlePreview(drawing)}
                                      className="inline-flex items-center justify-center p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-all"
                                      title="View Drawing"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => handleEdit(drawing)}
                                      className="inline-flex items-center justify-center p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 transition-all"
                                      title="Upload Drawing"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                                    </button>
                                  )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs  text-indigo-700">
                                      {(drawing.uploaded_by || 'S')[0].toUpperCase()}
                                    </div>
                                    <span className="text-slate-600 font-medium hidden sm:inline">{drawing.uploaded_by || 'Sales'}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                  <div className="flex justify-end gap-0.5">
                                    {drawing.status === 'SHARED' ? (
                                      <span className="p-1 text-emerald-600 bg-emerald-100 rounded inline-block hover:bg-emerald-200 transition-colors" title="Shared">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                      </span>
                                    ) : (
                                      <button 
                                        onClick={() => handleShareWithDesign(drawing.id)}
                                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                                        title="Share"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => handleEdit(drawing)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                                      title="Edit"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    </button>
                                    <button 
                                      onClick={() => handleViewRevisions(drawing)}
                                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-all"
                                      title="Revisions"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(drawing.id)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-all"
                                      title="Delete"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowEditModal(false)}></div>
            <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-5 transform transition-all">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-md text-slate-900">Edit Drawing</h3>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
                  ✕
                </button>
              </div>
              <p className="text-slate-600 text-xs mb-3">Drawing: <span className=" text-indigo-600">{editData.drawing_no}</span></p>
              
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className=" flex items-center gap-2 text-xs text-slate-600">Revision</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors text-xs"
                    value={editData.revision_no}
                    onChange={(e) => setEditData({...editData, revision_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className=" flex items-center gap-2 text-xs text-slate-600">Description</label>
                  <textarea 
                    className="w-full px-3 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors min-h-[60px] resize-none text-xs"
                    value={editData.description}
                    onChange={(e) => setEditData({...editData, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className=" flex items-center gap-2 text-xs text-slate-600">PDF File</label>
                  <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded p-2 hover:border-indigo-400 transition-colors bg-slate-50 cursor-pointer">
                    <input 
                      type="file" 
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
                      id="edit-file"
                    />
                    <label htmlFor="edit-file" className="cursor-pointer text-center w-full">
                      <svg className="mx-auto h-6 w-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                      <p className="text-xs text-slate-600 ">{editData.drawing_pdf ? editData.drawing_pdf.name : 'Click'}</p>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                  <button 
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-3 py-1.5 text-slate-700  hover:bg-slate-100 rounded transition-colors text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saveLoading}
                    className="flex-1 px-3 py-1.5 bg-indigo-600 text-white  rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                    {saveLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Revisions Modal */}
      {showRevisions && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowRevisions(false)}></div>
            <div className="relative bg-white rounded-lg shadow-2xl max-w-3xl w-full p-5">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-md text-slate-900">Revision History</h3>
                  <p className="text-slate-600 text-xs mt-0.5">Drawing: <span className=" text-indigo-600">{selectedDrawing?.drawing_no}</span></p>
                </div>
                <button onClick={() => setShowRevisions(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none font-light">
                  ✕
                </button>
              </div>

              {revisionsLoading ? (
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-slate-600  text-xs">Loading...</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-200 rounded">
                  <table className="min-w-full divide-y divide-slate-200 bg-white">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs  text-slate-700">Revision</th>
                        <th className="px-3 py-2 text-left text-xs  text-slate-700">Date</th>
                        <th className="px-3 py-2 text-left text-xs  text-slate-700">Description</th>
                        <th className="px-3 py-2 text-left text-xs  text-slate-700">File</th>
                        <th className="px-3 py-2 text-right text-xs  text-slate-700">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {revisions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-3 py-4 text-center text-slate-500 text-xs">
                            No revisions found
                          </td>
                        </tr>
                      ) : (
                        revisions.map((rev, i) => (
                          <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs ">{rev.revision_no || '0'}</span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600 font-medium">
                              {new Date(rev.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{rev.description || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {rev.drawing_pdf ? (
                                <button 
                                  onClick={() => handlePreview({ ...rev, file_path: rev.drawing_pdf })}
                                  className="inline-flex items-center justify-center p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded transition-colors"
                                  title="View Drawing"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              <div className="text-slate-900 text-xs text-xs">{rev.po_number || '—'}</div>
                              <div className="text-xs text-slate-500">SO-{String(rev.sales_order_id).padStart(4, '0')}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approved Drawings Modal */}
      {showApprovedDrawings && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowApprovedDrawings(false)}></div>
            <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5">
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-md text-slate-900">Approved Drawings</h3>
                  <p className="text-slate-600 text-xs mt-0.5">Design-approved drawings ready for quotation</p>
                </div>
                <button onClick={() => setShowApprovedDrawings(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none font-light">
                  ✕
                </button>
              </div>

              {approvedLoading ? (
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-slate-600  text-xs">Loading approved drawings...</p>
                </div>
              ) : Object.keys(approvedGroupedByClient).length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <p className="text-slate-500  text-xs">No approved drawings found</p>
                  <p className="text-slate-400 text-xs">Drawings must be approved by Design Engineer first</p>
                </div>
              ) : (
                <div className="">
                  {!selectedApprovedClient ? (
                    <div className="space-y-2">
                      <p className="text-xs  text-slate-700 ">Select a Client</p>
                      {Object.entries(approvedGroupedByClient).map(([clientName, clientData]) => (
                        <button
                          key={clientName}
                          onClick={() => handleSelectApprovedClient(clientName)}
                          className="w-full p-3 text-left border border-slate-200 rounded hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-slate-900 text-xs group-hover:text-emerald-700">{clientName}</p>
                              {clientData.email && <p className="text-xs text-slate-500">{clientData.email}</p>}
                              {clientData.phone && <p className="text-xs text-slate-500">{clientData.phone}</p>}
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs ">
                              {clientData.orders.reduce((sum, order) => sum + (order.items?.length || 0), 0)} items
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-slate-900">{selectedApprovedClient}</p>
                          <p className="text-xs text-slate-500">{selectedApprovedItems.length} items selected</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedApprovedClient(null);
                            setSelectedApprovedItems([]);
                            setQuotePrices({});
                          }}
                          className="px-3 py-1 text-xs  text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        >
                          ← Back
                        </button>
                      </div>

                      <div className="overflow-hidden border border-slate-200 rounded">
                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-3 py-2 text-left  text-slate-700">Drawing</th>
                              <th className="px-3 py-2 text-left  text-slate-700">Description</th>
                              <th className="px-3 py-2 text-center  text-slate-700">Qty</th>
                              <th className="px-3 py-2 text-left  text-slate-700">Unit</th>
                              <th className="px-3 py-2 text-right  text-slate-700">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedApprovedItems.map((item) => (
                              <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="px-3 py-2 whitespace-nowrap text-slate-900">
                                  <div className="flex items-center gap-2">
                                    {item.drawing_pdf && (
                                      <button 
                                        onClick={() => handlePreview({ ...item, file_path: item.drawing_pdf })}
                                        className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
                                        title="View Drawing"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                      </button>
                                    )}
                                    {item.drawing_no}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{item.description || '—'}</td>
                                <td className="px-3 py-2 text-center text-slate-900 ">{item.quantity}</td>
                                <td className="px-3 py-2 text-slate-600">{item.unit}</td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    step="0.01"
                                    value={quotePrices[item.id] || ''}
                                    onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-2 p-3 bg-slate-50 rounded border border-slate-200">
                        <label className="block text-xs  text-slate-700 ">Notes</label>
                        <textarea
                          value={quotationNotes}
                          onChange={(e) => setQuotationNotes(e.target.value)}
                          placeholder="Add any special notes or terms..."
                          className="w-full px-3 py-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded border border-emerald-200">
                        <div>
                          <p className="text-xs text-slate-600">Total Quotation Value</p>
                          <p className="text-xl  text-emerald-700">
                            ₹{calculateQuotationTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <button
                          onClick={handleCreateQuotation}
                          disabled={creatingQuotation || calculateQuotationTotal() === 0}
                          className="px-4 py-2 bg-emerald-600 text-white rounded  hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-xs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                          {creatingQuotation ? 'Creating...' : 'Create Quotation'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Add Client Requirement Modal */}
      <Modal 
        isOpen={showFormModal} 
        onClose={() => setShowFormModal(false)}
        title="Add Client Requirement"
      >
        <form onSubmit={handleAddDrawing} className="space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  checked={uploadMode === 'bulk'} 
                  onChange={() => setUploadMode('bulk')} 
                />
                <span className={`text-xs font-medium transition-colors ${uploadMode === 'bulk' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>Bulk Import (Excel)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  checked={uploadMode === 'manual'} 
                  onChange={() => setUploadMode('manual')} 
                />
                <span className={`text-xs font-medium transition-colors ${uploadMode === 'manual' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>Manual Entry</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-lg border border-slate-200">
            {/* Client Selection */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Client Name *</label>
              <div className="flex gap-1">
                <div className="relative flex-1 client-input-container">
                  <input 
                    type="text"
                    required
                    disabled={clientLocked}
                    placeholder="Type client name..."
                    className={`w-full px-3 py-1.5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-all ${clientLocked ? 'bg-slate-100 cursor-not-allowed text-slate-600 border-slate-300' : 'border-slate-300 hover:border-slate-400'}`}
                    value={newDrawing.client_name}
                    onChange={(e) => handleClientInput(e.target.value)}
                    onFocus={() => newDrawing.client_name && setShowSuggestions(true)}
                  />
                  {showSuggestions && clientSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                      {clientSuggestions.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleSelectClient(company)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <div className="text-slate-900 text-xs">{company.company_name}</div>
                          {company.contact_email && <div className="text-slate-500 text-xs">{company.contact_email}</div>}
                          {company.contact_mobile && <div className="text-slate-500 text-xs">{company.contact_mobile}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clientLocked && (
                  <button 
                    type="button"
                    onClick={() => setClientLocked(false)}
                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-100 transition-colors"
                    title="Change Client"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
              <input 
                type="text"
                placeholder="Contact person name"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.contact_person}
                onChange={(e) => setNewDrawing({...newDrawing, contact_person: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input 
                type="text"
                placeholder="Phone number"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.phone_number}
                onChange={(e) => setNewDrawing({...newDrawing, phone_number: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email"
                placeholder="Email address"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.email_address}
                onChange={(e) => setNewDrawing({...newDrawing, email_address: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <input 
                type="text"
                placeholder="Customer type"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.customer_type}
                onChange={(e) => setNewDrawing({...newDrawing, customer_type: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GSTIN</label>
              <input 
                type="text"
                placeholder="GST number"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.gstin}
                onChange={(e) => setNewDrawing({...newDrawing, gstin: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
              <input 
                type="text"
                placeholder="City"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.city}
                onChange={(e) => setNewDrawing({...newDrawing, city: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
              <input 
                type="text"
                placeholder="State"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.state}
                onChange={(e) => setNewDrawing({...newDrawing, state: e.target.value})}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Billing Address</label>
              <input 
                type="text"
                placeholder="Billing address"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.billing_address}
                onChange={(e) => setNewDrawing({...newDrawing, billing_address: e.target.value})}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Shipping Address</label>
              <input 
                type="text"
                placeholder="Shipping address"
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={newDrawing.shipping_address}
                onChange={(e) => setNewDrawing({...newDrawing, shipping_address: e.target.value})}
              />
            </div>
          </div>

          {/* CONDITIONAL FIELDS BASED ON MODE */}
          {uploadMode === 'manual' ? (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs  text-slate-700">Drawing Details</h3>
                <button 
                  type="button"
                  onClick={addManualDrawingRow}
                  className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-md text-[10px] hover:bg-indigo-100 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Drawing
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500  tracking-wider">Drawing # *</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500  tracking-wider">Description</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500  tracking-wider w-16">Rev</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500  tracking-wider w-16">Qty</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500  tracking-wider">File *</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-slate-500  tracking-wider">Notes</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium text-slate-500  tracking-wider w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {manualDrawings.map((drawing) => (
                      <tr key={drawing.id}>
                        <td className="px-2 py-2">
                          <input 
                            type="text" 
                            required
                            placeholder="DRW-1001"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            value={drawing.drawing_no}
                            onChange={(e) => handleManualDrawingChange(drawing.id, 'drawing_no', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input 
                            type="text" 
                            placeholder="Aluminum Frame"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            value={drawing.description}
                            onChange={(e) => handleManualDrawingChange(drawing.id, 'description', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input 
                            type="text" 
                            placeholder="A"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                            value={drawing.revision}
                            onChange={(e) => handleManualDrawingChange(drawing.id, 'revision', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input 
                            type="number" 
                            min="1"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                            value={drawing.qty}
                            onChange={(e) => handleManualDrawingChange(drawing.id, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="relative">
                            <input 
                              type="file" 
                              required={!drawing.file}
                              accept=".pdf,.dwg,.step,.stp"
                              className="hidden"
                              onChange={(e) => handleManualFileChange(e, drawing.id)}
                              id={`file-${drawing.id}`}
                            />
                            <label 
                              htmlFor={`file-${drawing.id}`}
                              className={`flex items-center gap-1 px-2 py-1 border border-dashed rounded text-[10px] cursor-pointer transition-colors ${drawing.file ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-400'}`}
                            >
                              <Plus className="w-3 h-3" />
                              <span className="truncate max-w-[60px]">{drawing.file ? drawing.file.name : 'Choose'}</span>
                            </label>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input 
                            type="text" 
                            placeholder="Notes..."
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            value={drawing.remarks}
                            onChange={(e) => handleManualDrawingChange(drawing.id, 'remarks', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {manualDrawings.length > 1 && (
                            <button 
                              type="button"
                              onClick={() => removeManualDrawingRow(drawing.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* BULK MODE */
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Excel File <span className="text-red-500">*</span></label>
                <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-400 transition-colors bg-slate-50 cursor-pointer">
                  <input 
                    type="file" 
                    required
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                    id="bulk-file"
                  />
                  <label htmlFor="bulk-file" className="cursor-pointer text-center w-full">
                    <svg className="mx-auto h-10 w-10 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                    <p className="text-sm text-slate-900 font-medium">{newDrawing.file ? newDrawing.file.name : 'Upload Excel File'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Format: Drawing No, Revision, Description, Qty, Drawing_File</p>
                    {newDrawing.file && (
                      <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        File selected
                      </p>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">ZIP File (Drawings)</label>
                <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-400 transition-colors bg-slate-50 cursor-pointer">
                  <input 
                    type="file" 
                    accept=".zip"
                    className="hidden"
                    onChange={handleZipFileChange}
                    id="bulk-zip"
                  />
                  <label htmlFor="bulk-zip" className="cursor-pointer text-center w-full">
                    <svg className="mx-auto h-10 w-10 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                    <p className="text-sm text-slate-900 font-medium">{newDrawing.zipFile ? newDrawing.zipFile.name : 'Upload ZIP File'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Contains images or PDFs of drawings</p>
                    {newDrawing.zipFile && (
                      <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        ZIP selected
                      </p>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-end border-t border-slate-200 pt-4">
            <button 
              type="button"
              onClick={() => {
                setNewDrawing({ client_name: '', contact_person: '', phone_number: '', email_address: '', customer_type: '', gstin: '', city: '', state: '', billing_address: '', shipping_address: '', drawing_no: '', revision: '', qty: 1, description: '', file: null, zipFile: null, remarks: '' });
                setManualDrawings([{ id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', file: null, zipFile: null, remarks: '' }]);
                setClientLocked(false);
              }}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Clear Form
            </button>
            <button 
              type="submit"
              disabled={loading}
              className={`px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-all flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Processing...' : uploadMode === 'bulk' ? 'Upload Excel' : 'Save Requirement'}
            </button>
            {uploadMode === 'manual' && (
              <button 
                type="button"
                onClick={handleAddAndSendToDesign}
                disabled={loading}
                className={`px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to Design
              </button>
            )}
          </div>

          {lastUploadedDrawings && lastUploadedDrawings.clientName && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <p className="text-sm  text-emerald-900">{lastUploadedDrawings.count} Drawings Uploaded</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Ready to be sent to the Design Engineering department</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => sendBulkUploadedToDesign(lastUploadedDrawings.clientName, lastUploadedDrawings.count)}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send to Design Now
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Drawing Preview Modal */}
      <DrawingPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default CustomerDrawing;

