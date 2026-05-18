import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Modal, DataTable, StatusBadge, FormControl, Tabs, Button } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Plus, Search, RefreshCw, Filter, FileText, Send, Loader2, Check, X, Package, ChevronDown, ChevronUp, Trash2, Edit2, Eye, History } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast, infoToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const CustomerDrawing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [drawings, setDrawings] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [editingRequirementId, setEditingRequirementId] = useState(null);
  const [editingRequirementData, setEditingRequirementData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadMode, setUploadMode] = useState('bulk'); // 'bulk' or 'manual'
  const [clientLocked, setClientLocked] = useState(false);
  const [deletedDrawingIds, setDeletedDrawingIds] = useState([]);

  // Revisions Modal State
  const [showRevisions, setShowRevisions] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClientDrawingsModal, setShowClientDrawingsModal] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);
  const [modalMode, setModalMode] = useState('edit'); // 'view' or 'edit'
  const [editData, setEditData] = useState({
    id: '',
    drawing_no: '',
    revision_no: '',
    description: '',
    client_name: '',
    contact_person: '',
    phone: '',
    email: '',
    customer_type: '',
    gstin: '',
    city: '',
    state: '',
    billing_address: '',
    shipping_address: '',
    qty: 1,
    remarks: '',
    drawing_pdf: null,
    file_path: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const requirementColumns = [
    {
      label: 'Project Name',
      key: 'project_name',
      sortable: true,
      render: (val) => (
        <span className=" text-slate-900">{val || '—'}</span>
      )
    },
    {
      label: 'Client Name',
      key: 'client_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className=" text-slate-900">{val || row.company_name || '—'}</span>
          {row.drawing_count > 0 && (
            <span className="text-xs  text-indigo-600 font-semibold">{row.drawing_count} Drawings</span>
          )}
        </div>
      )
    },
    {
      label: 'Contact & Email',
      key: 'contact_person',
      render: (val, row) => {
        const phone = row.contact_phone || row.phone || '—';
        const email = row.email_address || row.email || '—';
        const person = val || row.contact_person || '';

        return (
          <div className="flex flex-col">
            <span className=" text-slate-900">{phone}</span>
            <span className="text-xs  text-slate-500">{email}</span>
            {person && person !== phone && (
              <span className="text-xs  text-indigo-600 italic">{person}</span>
            )}
          </div>
        );
      }
    },
    {
      label: 'Delivery Date',
      key: 'delivery_date',
      render: (val) => val ? new Date(val).toLocaleDateString() : '—'
    },
    {
      label: 'Status',
      key: 'status',
      render: (val) => <StatusBadge status={val || 'PENDING'} />
    },
    {
      label: 'Actions',
      key: 'actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewClientDrawings(row)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-all"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => {
              setFormMode('edit');
              setEditingRequirementId(row.id);
              setEditingRequirementData(row);
              setUploadMode('manual');
              setShowFormModal(true);
              navigate(`${deptPrefix}/customer-drawing/edit-client?requirement_id=${row.public_id || row.id}`, {
                state: { type: 'edit-requirement', data: row }
              });
            }}
            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-all"
            title="Edit Client & Drawings"
          >
            <Edit2 size={15} />
          </button>
          {/* Unify Send to Design buttons: Show if there are unshared drawings OR if the requirement status is CREATED */}
          {(drawings.some(d => (d.client_name === (row.client_name || row.company_name)) && (d.status !== 'SHARED')) || 
            row.status?.toUpperCase() === 'CREATED') && (
            <button
              onClick={() => handleShareClientGroupWithDesign(row.client_name || row.company_name, row)}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all"
              title="Send to Design"
            >
              <Send size={15} />
            </button>
          )}
          <button
            onClick={() => handleDeleteRequirement(row.company_id, row.client_name)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all"
            title="Delete Client & Requirements"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
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
      setDrawings([]); // Clear stale data
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
      setCompanies([]); // Clear stale data
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
      setApprovedGroupedByClient({}); // Clear stale data
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
        <div style="text-align: left; font-size: 16px;">
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

  const groupedDrawings = drawings.reduce((acc, drawing) => {
    const client = drawing.client_name || 'Unassigned';
    if (!acc[client]) acc[client] = [];
    
    // Ensure uniqueness by drawing_master_id
    if (!acc[client].some(d => d.drawing_master_id === drawing.drawing_master_id)) {
      acc[client].push(drawing);
    }
    return acc;
  }, {});

  useEffect(() => {
    const clientName = searchParams.get('client_name');
    if (clientName && !loading && drawings.length > 0 && !viewingClient) {
      const lowerName = clientName.toLowerCase().trim();
      const matchedKey = Object.keys(groupedDrawings).find(k => k.toLowerCase().trim() === lowerName);
      if (matchedKey) {
        setViewingClient({
          name: matchedKey,
          drawings: groupedDrawings[matchedKey]
        });
        setShowClientDrawingsModal(true);
      }
    }
  }, [drawings, searchParams, loading, viewingClient]);

  const fetchSingleDrawing = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch drawing details');
      const drawing = await response.json();
      handleEdit(drawing, searchParams.get('mode') || 'edit');
    } catch (error) {
      console.error(error);
      errorToast('Failed to load drawing details');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequirementById = async (id) => {
    try {
      setReqLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch requirement details');
      const data = await response.json();
      
      setFormMode('edit');
      setEditingRequirementId(data.id);
      setEditingRequirementData(data);
      setUploadMode('manual');
      setShowFormModal(true);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load requirement details');
    } finally {
      setReqLoading(false);
    }
  };

  const fetchRequirements = async () => {
    try {
      setReqLoading(true);
      setRequirements([]); // Clear stale data
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders?includeWithoutPo=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch requirements');
      const data = await response.json();
      const filtered = data.filter(so =>
        so.project_name?.includes('Design Review') ||
        ['DESIGN_ENG', 'SALES', 'PRODUCTION', 'SHIPMENT', 'QUALITY', 'QC', 'ACCOUNTS'].includes(so.current_department)
      );

      // Group by client to avoid duplicates
      const grouped = filtered.reduce((acc, so) => {
        const clientName = so.client_name || so.company_name || 'Unassigned';
        if (!acc[clientName]) {
          // Find first item with contact info if available
          const firstDrawingWithContact = so.items?.find(item => item.contact_person || item.phone || item.email);
          
          acc[clientName] = {
            ...so,
            client_name: clientName,
            project_name: so.project_name,
            drawing_count: 0,
            original_items: [],
            // Ensure contact info is preserved
            contact_person: so.contact_person || firstDrawingWithContact?.contact_person,
            contact_phone: so.contact_phone || firstDrawingWithContact?.phone,
            email_address: so.email_address || firstDrawingWithContact?.email,
            customer_type: so.customer_type || firstDrawingWithContact?.customer_type,
            gstin: so.gstin || firstDrawingWithContact?.gstin,
            city: so.city || firstDrawingWithContact?.city,
            state: so.state || firstDrawingWithContact?.state,
            billing_address: so.billing_address || firstDrawingWithContact?.billing_address,
            shipping_address: so.shipping_address || firstDrawingWithContact?.shipping_address
          };
        }

        // Count items that are actual drawings (not existing items)
        const items = so.items?.filter(item => !item.item_code) || [];
        acc[clientName].drawing_count += items.length;
        acc[clientName].original_items = [...acc[clientName].original_items, ...items];

        // Keep the most recent delivery date if multiple exist
        if (so.delivery_date && (!acc[clientName].delivery_date || new Date(so.delivery_date) > new Date(acc[clientName].delivery_date))) {
          acc[clientName].delivery_date = so.delivery_date;
        }

        return acc;
      }, {});

      setRequirements(Object.values(grouped));
    } catch (error) {
      console.error(error);
    } finally {
      setReqLoading(false);
    }
  };

  useEffect(() => {
    fetchDrawings(searchTerm);
    fetchCompanies();
    fetchRequirements();

    // Initial check on mount or path change
    const path = window.location.pathname;
    const historyState = window.history.state;
    const drawingId = searchParams.get('drawing_id');
    const requirementId = searchParams.get('requirement_id');
    const clientName = searchParams.get('client_name');

    if (path === `${deptPrefix}/customer-drawing`) {
      setShowFormModal(false);
      setShowEditModal(false);
      setShowClientDrawingsModal(false);
    } else if (path.includes(`${deptPrefix}/customer-drawing/addclient`)) {
      setShowFormModal(true);
    } else if (path.includes(`${deptPrefix}/customer-drawing/edit-client`)) {
      if (historyState?.type === 'edit-requirement') {
        setFormMode('edit');
        setEditingRequirementId(historyState.data.id);
        setEditingRequirementData(historyState.data);
        setShowFormModal(true);
      } else if (requirementId) {
        // Handle requirementId as either real ID or public_id (UUID)
        const currentId = String(editingRequirementId);
        const currentPublicId = String(editingRequirementData?.public_id || '');
        const matchesCurrent = currentId === String(requirementId) || currentPublicId === String(requirementId);

        if (!editingRequirementId || !matchesCurrent) {
          fetchRequirementById(requirementId);
        }
        setShowFormModal(true);
      } else if (historyState?.type === 'edit-drawing') {
        setEditData(historyState.data);
        setModalMode(historyState.mode || 'edit');
        setShowEditModal(true);
        setShowFormModal(false);
      } else if (drawingId) {
        if (!editData.id || String(editData.id) !== String(drawingId)) {
          fetchSingleDrawing(drawingId);
        }
        setShowEditModal(true);
        setShowFormModal(false);
      }
    } else if (path.includes(`${deptPrefix}/customer-drawing/view-draw`)) {
      if (historyState?.type === 'view-client-drawings') {
        setViewingClient(historyState.data);
        setShowClientDrawingsModal(true);
      } else if (historyState?.type === 'edit-drawing') {
        setEditData(historyState.data);
        setModalMode(historyState.mode || 'view');
        setShowEditModal(true);
      } else if (drawingId) {
        if (!editData.id || String(editData.id) !== String(drawingId)) {
          fetchSingleDrawing(drawingId);
        }
        setShowEditModal(true);
      } else if (clientName) {
        setShowClientDrawingsModal(true);
      }
    }

    // Handle browser Back/Forward buttons
    const handlePopState = (event) => {
      const currentPath = window.location.pathname;
      const state = event.state;

      if (currentPath === `${deptPrefix}/customer-drawing`) {
        setShowFormModal(false);
        setShowEditModal(false);
        setShowClientDrawingsModal(false);
        setFormMode('add');
        setEditingRequirementId(null);
        setEditingRequirementData(null);
      } else if (currentPath.includes(`${deptPrefix}/customer-drawing/addclient`)) {
        setFormMode('add');
        setEditingRequirementId(null);
        setEditingRequirementData(null);
        setShowFormModal(true);
        setShowEditModal(false);
        setShowClientDrawingsModal(false);
      } else if (currentPath.includes(`${deptPrefix}/customer-drawing/edit-client`)) {
        if (state?.type === 'edit-requirement') {
          setFormMode('edit');
          setEditingRequirementId(state.data.id);
          setEditingRequirementData(state.data);
          setShowFormModal(true);
          setShowEditModal(false);
        } else if (state?.type === 'edit-drawing') {
          setEditData(state.data);
          setModalMode(state.mode || 'edit');
          setShowEditModal(true);
          setShowFormModal(false);
        } else {
          // If no state, try to use requirement_id from URL
          const params = new URLSearchParams(window.location.search);
          const rId = params.get('requirement_id');
          if (rId) {
            const currentId = String(editingRequirementId);
            const currentPublicId = String(editingRequirementData?.public_id || '');
            const matchesCurrent = currentId === String(rId) || currentPublicId === String(rId);

            if (!editingRequirementId || !matchesCurrent) {
              fetchRequirementById(rId);
            }
            setShowFormModal(true);
          }
        }
        setShowClientDrawingsModal(false);
      } else if (currentPath.includes(`${deptPrefix}/customer-drawing/view-draw`)) {
        if (state?.type === 'view-client-drawings') {
          setViewingClient(state.data);
        }
        setShowClientDrawingsModal(true);
        setShowFormModal(false);
        setShowEditModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location.pathname]);

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

  useEffect(() => {
    if (showFormModal && formMode === 'edit' && editingRequirementData) {
      setDeletedDrawingIds([]);
      const row = editingRequirementData;
      const company = companies.find(c => c.company_name === (row.client_name || row.company_name));
      
      const manualDrawings = (row.original_items || []).map(item => ({
        id: item.id || Date.now() + Math.random(),
        drawing_id: item.drawing_id || item.drawing_master_id,
        drawing_no: item.drawing_no || '',
        revision: item.revision || item.revision_no || '',
        qty: item.quantity || item.qty || 1,
        description: item.description || '',
        drawing_type: item.drawing_type || 'Part',
        remarks: item.remarks || '',
        file: null,
        file_path: item.file_path || item.drawing_pdf
      }));

      formik.setValues({
        client_name: row.client_name || row.company_name || '',
        project_name: row.project_name || '',
        contact_person: row.contact_person || company?.contact_person || '',
        phone_number: row.contact_phone || row.phone || company?.contact_mobile || company?.phone || '',
        email_address: row.email_address || row.email || company?.contact_email || company?.email || '',
        customer_type: row.customer_type || company?.customer_type || '',
        gstin: row.gstin || company?.gstin || '',
        city: row.city || company?.addresses?.find(a => a.address_type === 'BILLING')?.city || '',
        state: row.state || company?.addresses?.find(a => a.address_type === 'BILLING')?.state || '',
        billing_address: row.billing_address || (company ? (company.addresses?.find(a => a.address_type === 'BILLING') ? `${company.addresses.find(a => a.address_type === 'BILLING').line1}, ${company.addresses.find(a => a.address_type === 'BILLING').city}` : '') : ''),
        shipping_address: row.shipping_address || '',
        uploadMode: row.excel_path ? 'bulk' : 'manual',
        file: row.excel_path ? { name: row.excel_path.split('/').pop() } : null,
        zipFile: row.zip_path ? { name: row.zip_path.split('/').pop() } : null,
        manualDrawings: manualDrawings.length > 0 ? manualDrawings : [
          { id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', file: null, remarks: '' }
        ]
      });
      setClientLocked(true);
      if (row.excel_path) {
        setUploadMode('bulk');
      } else {
        setUploadMode('manual');
      }
    }
  }, [showFormModal, formMode, editingRequirementData, companies]);

  // Keep viewingClient drawings in sync with the main drawings list
  useEffect(() => {
    if (viewingClient && groupedDrawings[viewingClient.name]) {
      setViewingClient(prev => ({
        ...prev,
        drawings: groupedDrawings[viewingClient.name]
      }));
    }
  }, [groupedDrawings]);

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

  const handleEdit = (drawing, mode = 'edit') => {
    const company = companies.find(c => c.company_name === drawing.client_name);

    let billingAddressLine = '';
    let shippingAddressLine = '';

    if (company) {
      const billingAddress = company.addresses?.find(a => a.address_type === 'BILLING');
      const shippingAddress = company.addresses?.find(a => a.address_type === 'SHIPPING');
      billingAddressLine = billingAddress ? `${billingAddress.line1}${billingAddress.line2 ? ', ' + billingAddress.line2 : ''}, ${billingAddress.city}, ${billingAddress.state} ${billingAddress.pincode}` : '';
      shippingAddressLine = shippingAddress ? `${shippingAddress.line1}${shippingAddress.line2 ? ', ' + shippingAddress.line2 : ''}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}` : '';
    }

    const newEditData = {
      id: drawing.id,
      drawing_no: drawing.drawing_no,
      revision_no: drawing.revision || drawing.revision_no || '0',
      description: drawing.drawing_description || drawing.description || drawing.item_description || '',
      client_name: drawing.client_name,
      project_name: drawing.project_name || '',
      contact_person: drawing.contact_person || (company ? company.contact_person : ''),
      phone: drawing.phone || (company ? company.contact_mobile : ''),
      email: drawing.email || (company ? company.contact_email : ''),
      customer_type: drawing.customer_type || (company ? company.customer_type : ''),
      gstin: drawing.gstin || (company ? company.gstin : ''),
      city: drawing.city || (company ? (company.addresses?.find(a => a.address_type === 'BILLING')?.city || '') : ''),
      state: drawing.state || (company ? (company.addresses?.find(a => a.address_type === 'BILLING')?.state || '') : ''),
      billing_address: drawing.billing_address || billingAddressLine,
      shipping_address: drawing.shipping_address || shippingAddressLine,
      qty: drawing.qty || 1,
      remarks: drawing.remarks || '',
      drawing_pdf: null,
      file_path: drawing.file_path || drawing.drawing_pdf || ''
    };
    
    setEditData(newEditData);
    setModalMode(mode);
    setShowEditModal(true);

    // Update URL behavior
    const targetUrl = mode === 'view' ? `${deptPrefix}/customer-drawing/view-draw` : `${deptPrefix}/customer-drawing/edit-client`;
    navigate(`${targetUrl}?drawing_id=${drawing.id}`, {
      state: { type: 'edit-drawing', data: newEditData, mode }
    });
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
      formData.append('id', editData.id);
      formData.append('drawingNo', editData.drawing_no);
      formData.append('revisionNo', editData.revision_no);
      formData.append('description', editData.description);
      formData.append('clientName', editData.client_name);
      formData.append('projectName', editData.project_name || '');
      formData.append('contactPerson', editData.contact_person);
      formData.append('phoneNumber', editData.phone);
      formData.append('emailAddress', editData.email);
      formData.append('customerType', editData.customer_type);
      formData.append('gstin', editData.gstin);
      formData.append('city', editData.city);
      formData.append('state', editData.state);
      formData.append('billingAddress', editData.billing_address);
      formData.append('shippingAddress', editData.shipping_address);
      formData.append('qty', editData.qty);
      formData.append('remarks', editData.remarks);

      if (editData.drawing_pdf) {
        formData.append('drawing_pdf', editData.drawing_pdf);
      }

      const response = await fetch(`${API_BASE}/drawings/${editData.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update drawing');

      successToast('Customer drawing updated successfully');
      setShowEditModal(false);
      if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
        window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
      }
      fetchDrawings(searchTerm);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setSaveLoading(false);
    }
  };


  // Formik validation schema
  const validationSchema = Yup.object().shape({
    client_name: Yup.string().required('Client Name is required'),
    project_name: Yup.string().required('Project Name is required'),
    contact_person: Yup.string().nullable(),
    phone_number: Yup.string()
      .matches(/^[0-9]{10}$/, {
        message: 'Phone number must be exactly 10 digits',
        excludeEmptyString: true
      })
      .nullable(),
    email_address: Yup.string().email('Invalid email address').nullable(),
    customer_type: Yup.string().nullable(),
    gstin: Yup.string()
      .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
        message: 'Invalid GSTIN format',
        excludeEmptyString: true
      })
      .nullable(),
    city: Yup.string().nullable(),
    state: Yup.string().nullable(),
    billing_address: Yup.string().nullable(),
    file: Yup.mixed().when('uploadMode', {
      is: 'bulk',
      then: (schema) => schema.required('Excel file is required'),
      otherwise: (schema) => schema.nullable(),
    }),
    manualDrawings: Yup.array().when('uploadMode', {
      is: 'manual',
      then: (schema) => schema.of(
        Yup.object().shape({
          drawing_no: Yup.string().required('Drawing # is required'),
          drawing_type: Yup.string().required('Type is required'),
          file: Yup.mixed().nullable().optional(),
        })
      ),
      otherwise: (schema) => schema.nullable(),
    }),
  });

  const formik = useFormik({
    initialValues: {
      client_name: '',
      project_name: '',
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
      drawing_type: 'Part',
      file: null,
      zipFile: null,
      remarks: '',
      uploadMode: 'bulk',
      manualDrawings: [
        { id: Date.now() + Math.random(), drawing_no: '', revision: '', qty: 1, description: '', drawing_type: 'Part', file: null, remarks: '' }
      ],
    },
    validationSchema,
    onSubmit: async (values) => {
      console.log('Submitting Formik values:', values);
      try {
        setLoading(true);
        if (values.uploadMode === 'bulk') {
          const result = await saveSingleDrawing(values, false);
          if (result) {
            successToast(result.isExcelUpload ? `${result.count} Excel drawings imported successfully` : 'Drawing added successfully');
            formik.resetForm();
          }
        } else {
          let successCount = 0;
          
          if (formMode === 'edit') {
            // Handle deletions first
            if (deletedDrawingIds.length > 0) {
              const token = localStorage.getItem('authToken');
              await fetch(`${API_BASE}/drawings/delete/bulk`, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: deletedDrawingIds })
              });
              setDeletedDrawingIds([]);
            }

            // Update existing requirement logic
            for (const drawing of values.manualDrawings) {
              if (!drawing.drawing_no) continue;
              
              // If it has a file, it might be a new drawing added during edit OR an update with new file
              // If it has id and no file, it's just updating metadata
              if (drawing.id && !String(drawing.id).includes('.')) {
                // Update existing drawing metadata
                const token = localStorage.getItem('authToken');
                const formData = new FormData();
                formData.append('drawingNo', drawing.drawing_no);
                formData.append('projectName', values.project_name || '');
                formData.append('clientName', values.client_name || '');
                formData.append('contactPerson', values.contact_person || '');
                formData.append('phoneNumber', values.phone_number || '');
                formData.append('emailAddress', values.email_address || '');
                formData.append('customerType', values.customer_type || '');
                formData.append('gstin', values.gstin || '');
                formData.append('city', values.city || '');
                formData.append('state', values.state || '');
                formData.append('billingAddress', values.billing_address || '');
                formData.append('shippingAddress', values.shipping_address || '');
                formData.append('revisionNo', drawing.revision || '');
                formData.append('qty', drawing.qty || 1);
                formData.append('description', drawing.description || '');
                formData.append('drawing_type', drawing.drawing_type || 'Part');
                formData.append('remarks', drawing.remarks || '');
                if (drawing.file) {
                  formData.append('drawing_pdf', drawing.file);
                }

                // Use drawing_id if available, fallback to id (which should be the drawing_master_id for existing)
                const updateId = drawing.drawing_id || drawing.id;
                const response = await fetch(`${API_BASE}/drawings/${updateId}`, {
                  method: 'PATCH',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: formData
                });

                if (!response.ok) {
                  const errData = await response.json();
                  throw new Error(errData.message || `Failed to update drawing ${drawing.drawing_no}`);
                }
              } else {
                // Add new drawing to existing requirement
                await saveSingleDrawing({ ...values, ...drawing }, false);
              }
              successCount++;
            }
            if (successCount > 0) {
              successToast(`Requirement updated successfully`);
            } else {
              warningToast('No valid drawings found to update');
            }
          } else {
            for (const drawing of values.manualDrawings) {
              if (!drawing.drawing_no) continue;
              await saveSingleDrawing({ ...values, ...drawing }, false);
              successCount++;
            }

            if (successCount > 0) {
              successToast(`${successCount} drawings added successfully`);
              formik.setFieldValue('manualDrawings', [{ id: Date.now(), drawing_no: '', revision: '', qty: 1, description: '', drawing_type: 'Part', file: null, remarks: '' }]);
              setClientLocked(true);
            } else {
              warningToast('No drawings were added. Please fill in Drawing # and select a file for at least one row.');
            }
          }
        }
        
        if (formMode === 'edit') {
           setShowFormModal(false);
           setFormMode('add');
           setEditingRequirementId(null);
           setEditingRequirementData(null);
           if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
            window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
          }
        }

        fetchDrawings(searchTerm);
        fetchRequirements();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
    },
  });

  // Keep uploadMode state in sync with formik
  useEffect(() => {
    formik.setFieldValue('uploadMode', uploadMode);
  }, [uploadMode]);

  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      formik.setFieldValue('file', file);
    }
  };

  const handleZipFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      formik.setFieldValue('zipFile', file);
    }
  };

  const handleManualDrawingChange = (id, field, value) => {
    const updatedManualDrawings = formik.values.manualDrawings.map(d =>
      d.id === id ? { ...d, [field]: value } : d
    );
    formik.setFieldValue('manualDrawings', updatedManualDrawings);
  };

  const addManualDrawingRow = () => {
    const newRow = { id: Date.now() + Math.random(), drawing_no: '', revision: '', qty: 1, description: '', drawing_type: 'Part', file: null, remarks: '' };
    formik.setFieldValue('manualDrawings', [newRow, ...formik.values.manualDrawings]);
  };

  const removeManualDrawingRow = (id) => {
    const drawingToRemove = formik.values.manualDrawings.find(d => d.id === id);
    
    // Track for deletion if it's an existing drawing (not a temp one)
    if (drawingToRemove && drawingToRemove.id && !String(drawingToRemove.id).includes('.')) {
      setDeletedDrawingIds(prev => [...prev, drawingToRemove.drawing_id || drawingToRemove.id]);
    }

    if (formik.values.manualDrawings.length > 1) {
      const updatedManualDrawings = formik.values.manualDrawings.filter(d => d.id !== id);
      formik.setFieldValue('manualDrawings', updatedManualDrawings);
    } else {
      // If it's the last row, clear it instead of removing it
      formik.setFieldValue('manualDrawings', [
        { id: Date.now() + Math.random(), drawing_no: '', revision: '', qty: 1, description: '', drawing_type: 'Part', file: null, remarks: '' }
      ]);
    }
  };

  const handleManualFileChange = (e, id) => {
    const file = e.target.files[0];
    if (file) {
      handleManualDrawingChange(id, 'file', file);
    }
  };

  const handleClientInput = (value) => {
    formik.setFieldValue('client_name', value);

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

    formik.setValues({
      ...formik.values,
      client_name: company.company_name,
      contact_person: company.contact_person || '',
      phone_number: company.contact_mobile || company.phone || '',
      email_address: company.contact_email || company.email || '',
      customer_type: company.customer_type || '',
      gstin: company.gstin || '',
      city: company.city || '',
      state: company.state || '',
      billing_address: billingAddressLine,
      shipping_address: shippingAddressLine
    });
    setClientLocked(true);
    setShowSuggestions(false);
  };

  const saveSingleDrawing = async (drawingData, sendToDesign = false) => {
    const fileExt = drawingData.file ? drawingData.file.name.split('.').pop().toUpperCase() : '';
    const isExcel = fileExt === 'XLSX' || fileExt === 'XLS';

    // Removed mandatory file check as requested
    /*
    if (!drawingData.file) {
      warningToast('Drawing File is mandatory');
      return null;
    }
    */

    if (!isExcel && !drawingData.drawing_no) {
      warningToast('Drawing Number is mandatory');
      return null;
    }

    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('clientName', drawingData.client_name);
      formData.append('projectName', drawingData.project_name || '');
      formData.append('contactPerson', drawingData.contact_person || '');
      formData.append('phoneNumber', drawingData.phone_number || '');
      formData.append('emailAddress', drawingData.email_address || '');
      formData.append('customerType', drawingData.customer_type || '');
      formData.append('gstin', drawingData.gstin || '');
      formData.append('city', drawingData.city || '');
      formData.append('state', drawingData.state || '');
      formData.append('billingAddress', drawingData.billing_address || '');
      formData.append('shippingAddress', drawingData.shipping_address || '');

      formData.append('drawingNo', drawingData.drawing_no || (drawingData.file ? drawingData.file.name : 'BATCH_IMPORT'));
      formData.append('revision', drawingData.revision || '');
      formData.append('qty', drawingData.qty || 1);
      formData.append('description', drawingData.description || '');
      formData.append('drawing_type', drawingData.drawing_type || 'Part');
      formData.append('remarks', drawingData.remarks || '');
      formData.append('fileType', fileExt);
      if (drawingData.file) {
        formData.append('file', drawingData.file);
      }
      if (drawingData.zipFile) {
        formData.append('zipFile', drawingData.zipFile);
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
        await handleShareWithDesign(drawingId);
      } else if (isExcelUpload && sendToDesign) {
        await sendBulkUploadedToDesign(drawingData.client_name, savedDrawing.count);
      }

      return { drawingId, isExcelUpload, count: savedDrawing.count };
    } catch (error) {
      console.error(error);
      throw error;
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
        setShowFormModal(false);
        if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
          window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
        }
        fetchDrawings(searchTerm);
        fetchRequirements();
      }
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    }
  };

  const clientDrawingColumns = [
    { label: '#', key: 'id', render: (_, __, rowIdx) => rowIdx + 1, width: '50px' },
    { label: 'Drawing No', key: 'drawing_no', className: ' text-slate-900' },
    { label: 'Project Name', key: 'project_name' },
    { label: 'Description', key: 'drawing_description' },
    { 
      label: 'Type', 
      key: 'drawing_type',
      render: (val) => (
        <span className={`px-2 py-0.5 rounded text-xs border ${val === 'Assembly' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
          {val || 'Part'}
        </span>
      )
    },
    { 
      label: 'Revision', 
      key: 'revision', 
      className: 'text-center',
      render: (val, row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs  bg-slate-100 text-slate-700 border border-slate-200">
          {val || row.revision_no || '0'}
        </span>
      )
    },
    { label: 'Qty', key: 'qty', className: 'text-center text-indigo-600 ', render: (val) => val || 1 },
    { 
      label: 'File', 
      key: 'file_path', 
      className: 'text-center',
      render: (val, row) => (val || row.drawing_pdf) ? (
        <button
          onClick={() => handlePreview(row)}
          className="inline-flex items-center justify-center p-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-600 hover:text-white transition-all active:scale-95 "
          title="View Drawing"
        >
          <Eye size={15} />
        </button>
      ) : (
        <span className="text-slate-300 italic text-xs">No File</span>
      )
    },
  ];

  const revisionColumns = [
    { 
      label: 'Revision', 
      key: 'revision_no',
      render: (val) => (
        <span className="p-1 bg-indigo-100 text-indigo-700 rounded text-xs ">{val || '0'}</span>
      )
    },
    { 
      label: 'Date', 
      key: 'created_at',
      render: (val) => new Date(val).toLocaleDateString('en-IN')
    },
    { label: 'Description', key: 'description' },
    { 
      label: 'File', 
      key: 'drawing_pdf',
      className: 'text-center',
      render: (val, row) => val ? (
        <button
          onClick={() => handlePreview({ ...row, file_path: val })}
          className="inline-flex items-center justify-center p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded transition-colors"
          title="View Drawing"
        >
          <Eye size={16} />
        </button>
      ) : <span className="text-slate-400">—</span>
    },
    { 
      label: 'Reference', 
      key: 'po_number',
      className: 'text-right',
      render: (val, row) => (
        <div>
          <div className="text-slate-900 text-xs ">{val || '—'}</div>
          <div className="text-xs text-slate-500">SO-{String(row.sales_order_id).padStart(4, '0')}</div>
        </div>
      )
    }
  ];

  const approvedItemColumns = [
    { 
      label: 'Drawing', 
      key: 'drawing_no',
      render: (val, row) => (
        <div className="flex items-center gap-2 ">
          {row.drawing_pdf && (
            <button
              onClick={() => handlePreview({ ...row, file_path: row.drawing_pdf })}
              className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
              title="View Drawing"
            >
              <Eye size={14} />
            </button>
          )}
          {val}
        </div>
      )
    },
    { label: 'Description', key: 'description' },
    { label: 'Qty', key: 'quantity', className: 'text-center text-slate-900 ' },
    { label: 'Unit', key: 'unit' },
    { 
      label: 'Price', 
      key: 'price',
      className: 'text-right',
      render: (_, row) => (
        <input
          type="number"
          placeholder="0.00"
          step="0.01"
          value={quotePrices[row.id] || ''}
          onChange={(e) => handlePriceChange(row.id, e.target.value)}
          className="w-24 px-2 py-1 border border-slate-300 rounded text-right outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
        />
      )
    }
  ];

  const handleShareClientGroupWithDesign = async (clientName, requirement = null) => {
    const unsharedDrawings = groupedDrawings[clientName]?.filter(d => d.status !== 'SHARED') || [];

    const isCreatedStatus = requirement?.status?.toUpperCase() === 'CREATED';

    if (unsharedDrawings.length === 0 && !isCreatedStatus) {
      infoToast('All drawings for this client are already shared and requirement is in progress.');
      return;
    }

    const title = isCreatedStatus ? 'Send Requirement to Design?' : 'Send Drawings to Design?';
    const text = unsharedDrawings.length > 0 
      ? `Send all ${unsharedDrawings.length} unshared drawings to Design Department for review?`
      : `Move this requirement to Design Department for review?`;

    const result = await Swal.fire({
      title: title,
      text: text,
      showCancelButton: true,
      confirmButtonText: 'Yes, send',
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
        const token = localStorage.getItem('authToken');

        // 1. Share drawings if any unshared exist
        if (unsharedDrawings.length > 0) {
          await shareDrawingsBulkAPI(unsharedDrawings.map(d => d.drawing_master_id || d.id));
        }

        // 2. Update Sales Order status
        if (requirement && requirement.id) {
          const soResponse = await fetch(`${API_BASE}/sales-orders/${requirement.id}/send-to-design`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (!soResponse.ok) throw new Error('Failed to update requirement status');
        }

        successToast(`Successfully sent to Design Department`);
        fetchDrawings(searchTerm);
        fetchRequirements();
      } catch (error) {
        console.error(error);
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
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
        fetchDrawings(searchTerm);
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const handleViewClientDrawings = (client) => {
    // Handle both string (clientName) or object (row)
    const name = typeof client === 'string' ? client : (client.client_name || client.company_name);
    
    // Use a case-insensitive search if direct match fails
    let drawingsForClient = groupedDrawings[name] || [];
    if (drawingsForClient.length === 0 && name) {
      const lowerName = name.toLowerCase().trim();
      const matchedKey = Object.keys(groupedDrawings).find(k => k.toLowerCase().trim() === lowerName);
      if (matchedKey) drawingsForClient = groupedDrawings[matchedKey];
    }

    const viewData = {
      name: name,
      drawings: drawingsForClient
    };
    setViewingClient(viewData);
    setShowClientDrawingsModal(true);

    // Update URL behavior
    navigate(`${deptPrefix}/customer-drawing/view-draw?client_name=${encodeURIComponent(name)}`, {
      state: { type: 'view-client-drawings', data: viewData }
    });
  };

  const handleDeleteRequirement = async (companyId, clientName) => {
    const result = await Swal.fire({
      title: 'Delete Client?',
      text: `This will remove ${clientName} and all associated requirements/drawings. You won't be able to revert this!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete everything'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/companies/${companyId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Delete failed');
        successToast('Client and all associated data have been deleted.');
        fetchRequirements();
        fetchDrawings();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  return (
    <div className="space-y-2 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          
          <div>
            <h1 className="text-xl  text-slate-900 ">Customer Drawings</h1>
            <p className="text-xs text-slate-500 ">Manage customer reference drawings and technical documentation</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => { setShowApprovedDrawings(true); fetchApprovedDrawings(); }}
            icon={Check}
          >
            Approved Drawings
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setDeletedDrawingIds([]);
              setFormMode('add');
              setEditingRequirementId(null);
              setEditingRequirementData(null);
              formik.resetForm();
              setClientLocked(false);
              window.history.pushState({}, '', `${deptPrefix}/customer-drawing/addclient`);
              setShowFormModal(true);
            }}
            icon={Plus}
          >
            Client Requirement
          </Button>
        </div>
      </div>

      {/* SEARCH & FILTER SECTION */}
      

      {/* SECTION 2: CLIENT REQUIREMENTS TABLE */}
      <Card className="overflow-hidden">
        <div className="">
          <h2 className="text-lg  text-slate-800 flex items-center gap-2">
            Client Requirements
          </h2>
        </div>
        <div className="p-0">
          <DataTable
            columns={requirementColumns}
            data={requirements}
            loading={reqLoading}
            pageSize={10}
          />
        </div>
      </Card>

      {/* Edit/View Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
            window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
          }
        }}
        title={modalMode === 'view' ? 'View Drawing Details' : 'Edit Drawing'}
        size="4xl"
      >
        <form onSubmit={handleSave} className="space-y-2 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 bg-white p-2 rounded  border border-slate-200">
            {/* Client Info Section */}
            <div className="lg:col-span-1">
              <label className="block text-xs  text-slate-700 mb-1">Client Name *</label>
              <input
                type="text"
                readOnly
                className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 cursor-not-allowed text-slate-600"
                value={editData.client_name}
              />
            </div>

            <div>
              <label className="block text-xs  text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="Contact person name"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.contact_person}
                onChange={(e) => setEditData({ ...editData, contact_person: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="Phone number"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Email</label>
              <input
                type="email"
                disabled={modalMode === 'view'}
                placeholder="Email address"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Type</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="Customer type"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.customer_type}
                onChange={(e) => setEditData({ ...editData, customer_type: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="GST number"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.gstin}
                onChange={(e) => setEditData({ ...editData, gstin: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">City</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="City"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.city}
                onChange={(e) => setEditData({ ...editData, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">State</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="State"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.state}
                onChange={(e) => setEditData({ ...editData, state: e.target.value })}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs  text-slate-700 mb-1">Billing Address</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="Billing address"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.billing_address}
                onChange={(e) => setEditData({ ...editData, billing_address: e.target.value })}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs  text-slate-700 mb-1">Shipping Address</label>
              <input
                type="text"
                disabled={modalMode === 'view'}
                placeholder="Shipping address"
                className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={editData.shipping_address}
                onChange={(e) => setEditData({ ...editData, shipping_address: e.target.value })}
              />
            </div>
          </div>

          {/* Drawing Details Section */}
          <div className="mt-4">
            <h3 className="text-xs  text-slate-700 mb-2">Drawing Details</h3>
            <div className="bg-slate-50 p-2 rounded border border-slate-200 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Drawing # *</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 cursor-not-allowed text-slate-600"
                    value={editData.drawing_no}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Revision</label>
                  <input
                    type="text"
                    disabled={modalMode === 'view'}
                    className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={editData.revision_no}
                    onChange={(e) => setEditData({ ...editData, revision_no: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Qty</label>
                  <input
                    type="number"
                    disabled={modalMode === 'view'}
                    className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={editData.qty}
                    onChange={(e) => setEditData({ ...editData, qty: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Description</label>
                <textarea
                  disabled={modalMode === 'view'}
                  className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors min-h-[60px] resize-none ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Remarks</label>
                <textarea
                  disabled={modalMode === 'view'}
                  className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors min-h-[60px] resize-none ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  value={editData.remarks}
                  onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                />
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Update PDF File</label>
                  <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded p-2 hover:border-indigo-400 transition-colors bg-white cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.stp,.step,.igs,.iges,.dwg,.dxf,.png,.jpg,.jpeg"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => setEditData({ ...editData, drawing_pdf: e.target.files[0] })}
                    />
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <p className="mt-1 text-xs text-slate-500">{editData.drawing_pdf ? editData.drawing_pdf.name : 'Click to update PDF'}</p>
                    </div>
                  </div>
                </div>
              )}

              {editData.file_path && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500">Current File:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewDrawing({ ...editData, drawing_pdf: editData.file_path });
                      setShowPreviewModal(true);
                    }}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    View Current PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
                  window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
                }
              }}
              className="p-2 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              Close
            </button>
            {modalMode === 'edit' && (
              <>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-6 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saveLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* Revisions Modal */}
      {showRevisions && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-2 ">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowRevisions(false)}></div>
            <div className="relative bg-white rounded  shadow-2xl max-w-3xl w-full p-5">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-md text-slate-900">Revision History</h3>
                  <p className="text-slate-600 text-xs mt-0.5">Drawing: <span className=" text-indigo-600">{selectedDrawing?.drawing_no}</span></p>
                </div>
                <button onClick={() => setShowRevisions(false)} className="text-slate-400 hover:text-slate-600 text-xl  leading-none font-light">
                  ✕
                </button>
              </div>

              {revisionsLoading ? (
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded  animate-spin"></div>
                  </div>
                  <p className="text-slate-600  text-xs">Loading...</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-200 rounded">
                  <DataTable
                    columns={revisionColumns}
                    data={revisions}
                    pageSize={10}
                    hideHeader
                    emptyMessage="No revisions found"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approved Drawings Modal */}
      {showApprovedDrawings && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-2 ">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowApprovedDrawings(false)}></div>
            <div className="relative bg-white rounded  shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5">
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-md text-slate-900">Approved Drawings</h3>
                  <p className="text-slate-600 text-xs mt-0.5">Design-approved drawings ready for quotation</p>
                </div>
                <button onClick={() => setShowApprovedDrawings(false)} className="text-slate-400 hover:text-slate-600 text-xl  leading-none font-light">
                  ✕
                </button>
              </div>

              {approvedLoading ? (
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded  animate-spin"></div>
                  </div>
                  <p className="text-slate-600  text-xs">Loading approved drawings...</p>
                </div>
              ) : Object.keys(approvedGroupedByClient).length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                          className="w-full p-2 text-left border border-slate-200 rounded hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-slate-900 text-xs group-hover:text-emerald-700">{clientName}</p>
                              {clientData.email && <p className="text-xs text-slate-500">{clientData.email}</p>}
                              {clientData.phone && <p className="text-xs text-slate-500">{clientData.phone}</p>}
                            </div>
                            <span className="p-1  bg-emerald-100 text-emerald-700 rounded text-xs ">
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
                          className="p-2  text-xs  text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        >
                          ← Back
                        </button>
                      </div>

                      <div className="overflow-hidden border border-slate-200 rounded">
                        <DataTable
                          columns={approvedItemColumns}
                          data={selectedApprovedItems}
                          pageSize={100}
                          hideHeader
                          emptyMessage="No items selected"
                        />
                      </div>

                      <div className="space-y-2 p-2 bg-slate-50 rounded border border-slate-200">
                        <label className="block text-xs  text-slate-700 ">Notes</label>
                        <textarea
                          value={quotationNotes}
                          onChange={(e) => setQuotationNotes(e.target.value)}
                          placeholder="Add any special notes or terms..."
                          className="w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <div>
                          <p className="text-xs text-slate-600">Total Quotation Value</p>
                          <p className="text-xl  text-emerald-700">
                            ₹{calculateQuotationTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <button
                          onClick={handleCreateQuotation}
                          disabled={creatingQuotation || calculateQuotationTotal() === 0}
                          className="p-2  bg-emerald-600 text-white rounded  hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2  text-xs"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
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
        onClose={() => {
          setDeletedDrawingIds([]);
          setShowFormModal(false);
          setFormMode('add');
          setEditingRequirementId(null);
          setEditingRequirementData(null);
          formik.resetForm();
          setClientLocked(false);
          if (location.pathname !== `${deptPrefix}/customer-drawing`) {
            window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
          }
        }}
        title={formMode === 'edit' ? 'Update Client Requirement' : 'Add Client Requirement'}
      >
        <form onSubmit={formik.handleSubmit} className="space-y-2">
          <div className="flex justify-between items-center bg-slate-50 p-2 rounded  border border-slate-200">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2  cursor-pointer group">
                <input
                  type="radio"
                  name="uploadMode"
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  checked={uploadMode === 'bulk'}
                  onChange={() => setUploadMode('bulk')}
                />
                <span className={`text-xs  transition-colors ${uploadMode === 'bulk' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>Bulk Import (Excel)</span>
              </label>
              <label className="flex items-center gap-2  cursor-pointer group">
                <input
                  type="radio"
                  name="uploadMode"
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  checked={uploadMode === 'manual'}
                  onChange={() => setUploadMode('manual')}
                />
                <span className={`text-xs  transition-colors ${uploadMode === 'manual' ? 'text-indigo-600' : 'text-slate-600 group-hover:text-slate-900'}`}>Manual Entry</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 bg-white p-2 rounded  border border-slate-200">
            {/* Project Name */}
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Project Name *</label>
              <input
                type="text"
                name="project_name"
                placeholder="Project Name"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.project_name && formik.errors.project_name ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.project_name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.project_name && formik.errors.project_name && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.project_name}</div>
              )}
            </div>

            {/* Client Selection */}
            <div className="lg:col-span-1">
              <label className="block text-xs  text-slate-700 mb-1">Client Name *</label>
              <div className="flex gap-1">
                <div className="relative flex-1 client-input-container">
                  <input
                    type="text"
                    name="client_name"
                    disabled={clientLocked}
                    placeholder="Type client name..."
                    className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-all ${clientLocked ? 'bg-slate-100 cursor-not-allowed text-slate-600 border-slate-300' : 'border-slate-300 hover:border-slate-400'} ${formik.touched.client_name && formik.errors.client_name ? 'border-red-500' : ''}`}
                    value={formik.values.client_name}
                    onChange={(e) => handleClientInput(e.target.value)}
                    onBlur={formik.handleBlur}
                    onFocus={() => formik.values.client_name && setShowSuggestions(true)}
                  />
                  {formik.touched.client_name && formik.errors.client_name && (
                    <div className="text-red-500 text-xs  mt-0.5">{formik.errors.client_name}</div>
                  )}
                  {showSuggestions && clientSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                      {clientSuggestions.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleSelectClient(company)}
                          className="w-full text-left p-2 hover:bg-indigo-50 text-xs border-b border-slate-100 last:border-b-0 transition-colors"
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
              <label className="block text-xs  text-slate-700 mb-1">Contact Person *</label>
              <input
                type="text"
                name="contact_person"
                placeholder="Contact person name"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.contact_person && formik.errors.contact_person ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.contact_person}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.contact_person && formik.errors.contact_person && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.contact_person}</div>
              )}
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Phone *</label>
              <input
                type="text"
                name="phone_number"
                maxLength={10}
                placeholder="10 digit phone number"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.phone_number && formik.errors.phone_number ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.phone_number}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  formik.setFieldValue('phone_number', val);
                }}
                onBlur={formik.handleBlur}
              />
              {formik.touched.phone_number && formik.errors.phone_number && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.phone_number}</div>
              )}
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                name="email_address"
                placeholder="Email address"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.email_address && formik.errors.email_address ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.email_address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.email_address && formik.errors.email_address && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.email_address}</div>
              )}
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">Type *</label>
              <input
                type="text"
                name="customer_type"
                placeholder="Customer type"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.customer_type && formik.errors.customer_type ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.customer_type}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.customer_type && formik.errors.customer_type && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.customer_type}</div>
              )}
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                name="gstin"
                placeholder="GST number"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.gstin && formik.errors.gstin ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.gstin}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.gstin && formik.errors.gstin && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.gstin}</div>
              )}
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">City *</label>
              <input
                type="text"
                name="city"
                placeholder="City"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.city && formik.errors.city ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.city}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.city && formik.errors.city && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.city}</div>
              )}
            </div>
            <div>
              <label className="block text-xs  text-slate-700 mb-1">State *</label>
              <input
                type="text"
                name="state"
                placeholder="State"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.state && formik.errors.state ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.state}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.state && formik.errors.state && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.state}</div>
              )}
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs  text-slate-700 mb-1">Billing Address *</label>
              <input
                type="text"
                name="billing_address"
                placeholder="Billing address"
                className={`w-full p-2 .5 border rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${formik.touched.billing_address && formik.errors.billing_address ? 'border-red-500' : 'border-slate-300'}`}
                value={formik.values.billing_address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.billing_address && formik.errors.billing_address && (
                <div className="text-red-500 text-xs  mt-0.5">{formik.errors.billing_address}</div>
              )}
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs  text-slate-700 mb-1">Shipping Address</label>
              <input
                type="text"
                name="shipping_address"
                placeholder="Shipping address"
                className="w-full p-2 .5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors"
                value={formik.values.shipping_address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
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
                  className="p-2  bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-md text-xs  hover:bg-indigo-100 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Drawing
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded ">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Drawing # *</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Description</th>
                      <th className="p-2 text-left text-xs   text-slate-500   w-16">Rev</th>
                      <th className="p-2 text-left text-xs   text-slate-500   w-16">Qty</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">File *</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Type *</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Notes</th>
                      <th className="p-2 text-center text-xs   text-slate-500   w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {formik.values.manualDrawings.map((drawing, index) => (
                      <tr key={drawing.id}>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            name={`manualDrawings[${index}].drawing_no`}
                            placeholder="DRW-1001"
                            className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${formik.touched.manualDrawings?.[index]?.drawing_no && formik.errors.manualDrawings?.[index]?.drawing_no ? 'border-red-500' : 'border-slate-300'}`}
                            value={drawing.drawing_no}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            name={`manualDrawings[${index}].description`}
                            placeholder="Aluminum Frame"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            value={drawing.description}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            name={`manualDrawings[${index}].revision`}
                            placeholder="A"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                            value={drawing.revision}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            name={`manualDrawings[${index}].qty`}
                            min="1"
                            step="0.01"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                            value={drawing.qty}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="relative">
                              <input
                                type="file"
                                name={`manualDrawings[${index}].file`}
                                accept=".pdf,.dwg,.dxf,.step,.stp,.igs,.iges,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => handleManualFileChange(e, drawing.id)}
                                onBlur={formik.handleBlur}
                                id={`file-${drawing.id}`}
                              />
                              <label
                                htmlFor={`file-${drawing.id}`}
                                className={`flex items-center gap-1 px-2 py-1 border border-dashed rounded text-xs  cursor-pointer transition-colors ${drawing.file ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : (formik.errors.manualDrawings?.[index]?.file ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-400')}`}
                              >
                                <Plus className="w-3 h-3" />
                                <span className="truncate max-w-[60px]">{drawing.file ? drawing.file.name : 'Choose'}</span>
                              </label>
                            </div>
                            {formMode === 'edit' && drawing.file_path && !drawing.file && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDrawing({ ...drawing, drawing_pdf: drawing.file_path });
                                  setShowPreviewModal(true);
                                }}
                                className="text-xs  text-indigo-600 hover:underline text-left flex items-center gap-1"
                              >
                                <Eye size={10} /> View Current
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            name={`manualDrawings[${index}].drawing_type`}
                            className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${formik.touched.manualDrawings?.[index]?.drawing_type && formik.errors.manualDrawings?.[index]?.drawing_type ? 'border-red-500' : 'border-slate-300'}`}
                            value={drawing.drawing_type || 'Part'}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                          >
                            <option value="Part">Part</option>
                            <option value="Assembly">Assembly</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            name={`manualDrawings[${index}].remarks`}
                            placeholder="Notes..."
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            value={drawing.remarks}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeManualDrawingRow(drawing.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* BULK MODE */
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs  text-slate-700 mb-2">Excel File <span className="text-red-500">*</span></label>
                <div className={`flex items-center justify-center border-2 border-dashed rounded  p-2 hover:border-indigo-400 transition-colors bg-slate-50 cursor-pointer ${formik.touched.file && formik.errors.file ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}>
                  <input
                    type="file"
                    name="file"
                    accept=".xlsx,.xls"
                    className="absolute  w-[48%] h-[60px] cursor-pointer opacity-0"
                    onChange={handleFileChange}
                    onBlur={formik.handleBlur}
                  />
                  <div className="text-center">
                    <FileText className={`mx-auto h-6 w-6 ${formik.values.file ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <p className="mt-1 text-xs  text-slate-500">{formik.values.file ? formik.values.file.name : 'Upload Excel File'}</p>
                    <p className="text-[8px] text-slate-400">Format: Drawing No, Revision, Description, Type, Qty, Drawing_File</p>
                  </div>
                </div>
                {formik.touched.file && formik.errors.file && (
                  <div className="text-red-500 text-xs  mt-1">{formik.errors.file}</div>
                )}
              </div>

              <div>
                <label className="block text-xs  text-slate-700 mb-2">ZIP File (Drawings)</label>
                <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded  p-2 hover:border-indigo-400 transition-colors bg-slate-50 cursor-pointer">
                  <input
                    type="file"
                    name="zipFile"
                    accept=".zip,.rar,.7z"
                    className="absolute  w-[48%] h-[60px] cursor-pointer opacity-0"
                    onChange={handleZipFileChange}
                  />
                  <div className="text-center">
                    <Package className={`mx-auto h-6 w-6 ${formik.values.zipFile ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <p className="mt-1 text-xs  text-slate-500">{formik.values.zipFile ? formik.values.zipFile.name : 'Upload ZIP File'}</p>
                    <p className="text-[8px] text-slate-400">Contains images or PDFs of drawings</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowFormModal(false);
                formik.resetForm();
                setClientLocked(false);
                setFormMode('add');
                setEditingRequirementId(null);
                setEditingRequirementData(null);
              }}
              className="p-2 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              {formMode === 'edit' ? 'Cancel' : 'Clear Form'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              <Send className="w-3 h-3" />
              {formMode === 'edit' ? (loading ? 'Updating...' : 'Update Requirement') : (uploadMode === 'bulk' ? 'Upload Excel' : 'Add Requirements')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Client Drawings Modal */}
      <Modal
        isOpen={showClientDrawingsModal}
        onClose={() => {
          setShowClientDrawingsModal(false);
          if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
            window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
          }
        }}
        title={viewingClient ? `Drawings for ${viewingClient.name}` : 'Client Drawings'}
        width="max-w-5xl"
      >
        {viewingClient && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded overflow-hidden">
              <DataTable
                columns={clientDrawingColumns}
                data={viewingClient.drawings}
                pageSize={10}
                emptyMessage="No drawings found for this client"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  setShowClientDrawingsModal(false);
                  if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
                    window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
                  }
                }}
                className="px-6 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
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

