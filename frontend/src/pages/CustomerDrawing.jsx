import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Modal, DataTable, StatusBadge, FormControl, Tabs, Button } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Plus, Search, RefreshCw, Filter, FileText, Send, Loader2, Check, X, Package, ChevronDown, ChevronUp, Trash2, Edit2, Eye, History, Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, warningToast, infoToast } from '../utils/toast';

const toast = {
  error: errorToast,
  success: successToast,
  warning: warningToast,
  info: infoToast
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const getEmptyDrawingRow = () => ({
  id: crypto.randomUUID(),
  drawing_no: '',
  revision: '',
  qty: 1,
  description: '',
  hsn_code: '',
  delivery_date: '',
  drawing_type: 'Part',
  files: [],
  existingFiles: [],
  remarks: '',
  status: 'PENDING'
});

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

  const checkStatusRestricted = (soIdOrStatus) => {
    if (!soIdOrStatus) return { restricted: false };

    // Normalize status string if it looks like one
    const normalized = String(soIdOrStatus).toUpperCase().replace(/_/g, ' ').trim();
    // QUOTATION SENT: updates are allowed
    if (normalized === 'BOM SUBMITTED') {
      return { restricted: true, message: 'bom allready sent now cant update requirement' };
    }

    // Try finding the requirement by ID or public_id
    const req = requirements.find(r =>
      String(r.id) === String(soIdOrStatus) ||
      String(r.public_id) === String(soIdOrStatus)
    );
    if (req) {
      const reqNormalized = String(req.status || '').toUpperCase().replace(/_/g, ' ').trim();
      // QUOTATION SENT: updates are allowed
      if (reqNormalized === 'BOM SUBMITTED') {
        return { restricted: true, message: 'bom allready sent now cant update requirement' };
      }
    }

    return { restricted: false };
  };

  const [drawings, setDrawings] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [requirementsSearchTerm, setRequirementsSearchTerm] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [editingRequirementId, setEditingRequirementId] = useState(null);
  const [editingRequirementData, setEditingRequirementData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadMode, setUploadMode] = useState('bulk'); // 'bulk' or 'manual'
  const [clientLocked, setClientLocked] = useState(false);
  const [deletedDrawingIds, setDeletedDrawingIds] = useState([]);
  const [activeDrawingIdForFiles, setActiveDrawingIdForFiles] = useState(null);

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
    drawing_type: 'Part',
    hsn_code: '',
    delivery_date: '',
    drawing_pdf: null,
    file_path: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const requirementColumns = [
    {
      label: 'Project Name',
      key: 'project_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-900 font-medium">{val || '—'}</span>
          {row.drawing_count > 0 && (
            <span className="text-xs text-indigo-600 font-semibold">{row.drawing_count} Drawings</span>
          )}
        </div>
      )
    },
    {
      label: 'Client Name',
      key: 'client_name',
      sortable: true,
      render: (val, row) => (
        <span className=" text-slate-900">{val || row.company_name || '—'}</span>
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
          {/* Unify Send to Design buttons: Show if there are unshared drawings */}
          {(row.original_items?.some(d => !['SHARED', 'DESIGN_IN_REVIEW', 'APPROVED', 'REJECTED'].includes(d.status?.trim().toUpperCase())) ||
            row.status?.trim().toUpperCase() === 'CREATED') && (
              <button
                onClick={() => handleShareClientGroupWithDesign(row.client_name || row.company_name, row)}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                title="Send to Design"
              >
                <Send size={15} />
              </button>
            )}
          <button
            onClick={() => handleDeleteProject(row.id, row.project_name)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all"
            title="Delete Project & Drawings"
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
            po_net_total: order.po_net_total,
            order_contact_person: order.contact_person,
            order_email: order.email,
            order_phone: order.phone,
            order_address: order.address,
            order_project_name: order.project_name
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

    // Find the first priced item and extract its order/project contact person and email
    const firstQuotedItem = selectedApprovedItems.find(item => quotePrices[item.id] && quotePrices[item.id] > 0);
    const contactPerson = firstQuotedItem?.order_contact_person || clientData.contact_person;
    const email = firstQuotedItem?.order_email || clientData.email;
    const phone = firstQuotedItem?.order_phone || clientData.phone;
    const address = firstQuotedItem?.order_address || clientData.address;
    const projectName = firstQuotedItem?.order_project_name || clientData.orders?.[0]?.project_name || '';

    if (!email) {
      errorToast('Client email address not available. Cannot create quotation.');
      return;
    }

    const result = await Swal.fire({
      title: 'Create Quotation',
      html: `
        <div style="text-align: left; font-size: 16px;">
          <p><strong>Client:</strong> ${clientData.company_name}</p>
          <p><strong>Project:</strong> ${projectName}</p>
          <p><strong>Contact Person:</strong> ${contactPerson}</p>
          <p><strong>Email:</strong> ${email}</p>
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
          contact_person: contactPerson,
          email: email,
          phone: phone,
          address: address,
          projectName: projectName,
          items: selectedApprovedItems.map(item => ({
            sales_order_id: item.sales_order_id,
            sales_order_item_id: item.id,
            drawing_no: item.drawing_no,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            quoted_price: quotePrices[item.id] || 0,
            quotedPrice: quotePrices[item.id] || 0
          })),
          total_amount: calculateQuotationTotal(),
          totalAmount: calculateQuotationTotal(),
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

  const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const groupedDrawings = useMemo(() => {
    return drawings.reduce((acc, drawing) => {
      const client = normalize(drawing.client_name || 'Unassigned');
      const project = normalize(drawing.project_name || 'No Project');

      if (!acc[client]) acc[client] = {};
      if (!acc[client][project]) acc[client][project] = [];

      const isDuplicate = acc[client][project].some(d => {
        if (d.drawing_master_id && drawing.drawing_master_id) {
          return d.drawing_master_id === drawing.drawing_master_id;
        }
        return d.id === drawing.id;
      });

      if (!isDuplicate) {
        acc[client][project].push(drawing);
      }
      return acc;
    }, {});
  }, [drawings]);

  useEffect(() => {
    const clientName = searchParams.get('client_name');
    const projectName = searchParams.get('project_name');
    const requirementId = searchParams.get('requirement_id');

    if (clientName && !loading && drawings.length > 0 && !viewingClient) {
      const lowerClient = normalize(clientName);
      const lowerProject = projectName ? normalize(projectName) : null;

      if (groupedDrawings[lowerClient]) {
        let drawingsToShow = [];
        let finalProjectName = projectName;

        if (requirementId) {
          const rawDrawings = drawings.filter(d =>
            normalize(d.client_name) === lowerClient &&
            String(d.sales_order_id) === String(requirementId)
          );
          const seen = new Set();
          drawingsToShow = [];
          for (const d of rawDrawings) {
            const dNo = d.drawing_no ? String(d.drawing_no).trim().toLowerCase() : null;
            const dId = d.drawing_master_id || d.id;
            const key = dNo || (dId ? `id_${dId}` : d.id);
            if (key && !seen.has(key)) {
              seen.add(key);
              drawingsToShow.push(d);
            }
          }
          if (drawingsToShow.length > 0) {
            finalProjectName = drawingsToShow[0].project_name || drawingsToShow[0].projectName;
          }
        } else if (lowerProject) {
          drawingsToShow = groupedDrawings[lowerClient][lowerProject] || [];
          if (drawingsToShow.length > 0) {
            finalProjectName = drawingsToShow[0].project_name || drawingsToShow[0].projectName;
          }
        } else {
          drawingsToShow = Object.values(groupedDrawings[lowerClient]).flat();
        }

        if (drawingsToShow.length > 0) {
          setViewingClient({
            name: drawingsToShow[0].client_name || drawingsToShow[0].clientName,
            projectName: finalProjectName,
            requirementId: requirementId,
            drawings: drawingsToShow
          });
          setShowClientDrawingsModal(true);
        }
      }
    }
  }, [drawings, searchParams, loading, groupedDrawings, viewingClient]);

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

  const fetchRequirements = async (initial = false) => {
    try {
      if (initial) setRequirements([]);
      setReqLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders?includeWithoutPo=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch requirements');
      const data = await response.json();
      const filtered = data.filter(so => {
        const dept = (so.current_department || '').toUpperCase().trim();
        const status = (so.status || '').toUpperCase().trim();

        // Show if it's a "Design Review" project OR if it's in relevant departments
        // Sales should see things in SALES, DESIGN_ENG (shared), or initial departments
        return so.project_name?.includes('Design Review') ||
          ['SALES', 'DESIGN_ENG', 'PRODUCTION', 'SHIPMENT', 'QUALITY', 'QC', 'ACCOUNTS'].includes(dept) ||
          dept === '';
      });

      // Group by Sales Order Public ID (Project ID) to keep projects separate
      const grouped = filtered.reduce((acc, so) => {
        const clientName = so.client_name || so.company_name || 'Unassigned';
        // Use public_id for grouping as requested, fallback to id
        const key = so.public_id || so.id;

        if (!acc[key]) {
          // Find first item with contact info if available
          const firstDrawingWithContact = so.items?.find(item => item.contact_person || item.phone || item.email);

          acc[key] = {
            ...so,
            client_name: clientName,
            project_name: so.project_name,
            drawing_count: 0,
            original_items: [],
            // Ensure contact info is preserved
            contact_person: firstDrawingWithContact?.contact_person || so.contact_person,
            contact_phone: firstDrawingWithContact?.phone || so.contact_phone,
            email_address: firstDrawingWithContact?.email || so.email_address,
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
        acc[key].original_items = [...acc[key].original_items, ...items];

        // Deduplicate original_items by drawing number to get correct unique drawing count
        const uniqueItems = [];
        const seenDrawings = new Set();
        for (const item of acc[key].original_items) {
          const dNo = item.drawing_no ? String(item.drawing_no).trim().toLowerCase() : null;
          const dId = item.drawing_id || item.drawing_master_id;
          const mapKey = dNo || (dId ? `id_${dId}` : item.id);

          if (mapKey && !seenDrawings.has(mapKey)) {
            seenDrawings.add(mapKey);
            uniqueItems.push(item);
          }
        }
        // Do NOT overwrite acc[key].original_items with uniqueItems so all drawing rows are preserved!
        acc[key].drawing_count = uniqueItems.length;

        // Keep the most recent delivery date if multiple exist
        if (so.delivery_date && (!acc[key].delivery_date || new Date(so.delivery_date) > new Date(acc[key].delivery_date))) {
          acc[key].delivery_date = so.delivery_date;
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
    fetchRequirements(true);
  }, []);

  useEffect(() => {
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

      const manualDrawings = (row.original_items || []).map(item => {
        const pathVal = item.file_path || item.drawing_pdf || '';
        const existingFiles = pathVal.split(',').filter(Boolean);
        return {
          id: item.id || crypto.randomUUID(),
          drawing_id: item.drawing_id || item.drawing_master_id,
          drawing_no: item.drawing_no || '',
          revision: item.revision || item.revision_no || '',
          qty: (item.quantity || item.qty) ? parseFloat(item.quantity || item.qty) : 1,
          description: item.description || '',
          hsn_code: item.hsn_code || '',
          delivery_date: item.delivery_date ? new Date(item.delivery_date).toISOString().split('T')[0] : '',
          drawing_type: item.drawing_type || 'Part',
          remarks: item.remarks || '',
          files: [],
          existingFiles: existingFiles,
          status: item.status || 'PENDING'
        };
      });

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
        manualDrawings: manualDrawings.length > 0 ? manualDrawings : [getEmptyDrawingRow()]
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
    if (viewingClient) {
      const clientKey = normalize(viewingClient.name);
      const projectKey = viewingClient.projectName ? normalize(viewingClient.projectName) : null;
      const reqId = viewingClient.requirementId;

      let updatedDrawings = null;
      if (reqId) {
        const rawDrawings = drawings.filter(d =>
          normalize(d.client_name) === clientKey &&
          String(d.sales_order_id) === String(reqId)
        );
        const seen = new Set();
        updatedDrawings = [];
        for (const d of rawDrawings) {
          const dNo = d.drawing_no ? String(d.drawing_no).trim().toLowerCase() : null;
          const dId = d.drawing_master_id || d.id;
          const key = dNo || (dId ? `id_${dId}` : d.id);
          if (key && !seen.has(key)) {
            seen.add(key);
            updatedDrawings.push(d);
          }
        }
      } else if (groupedDrawings[clientKey]) {
        if (projectKey) {
          if (groupedDrawings[clientKey][projectKey]) {
            updatedDrawings = groupedDrawings[clientKey][projectKey];
          }
        } else {
          updatedDrawings = Object.values(groupedDrawings[clientKey]).flat();
        }
      }

      // Only update if data actually changed and it's a valid array to avoid infinite loops
      if (Array.isArray(updatedDrawings) && JSON.stringify(updatedDrawings) !== JSON.stringify(viewingClient.drawings)) {
        setViewingClient(prev => ({
          ...prev,
          drawings: updatedDrawings
        }));
      }
    }
  }, [drawings, groupedDrawings, viewingClient?.name, viewingClient?.projectName, viewingClient?.requirementId]);

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
      hsn_code: drawing.hsn_code || '',
      delivery_date: drawing.delivery_date ? new Date(drawing.delivery_date).toISOString().split('T')[0] : '',
      qty: drawing.qty ? parseFloat(drawing.qty) : 1,
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
    if (editData.id) {
      const drawing = drawings.find(d => d.id === editData.id || d.drawing_master_id === editData.id);
      if (drawing?.sales_order_id) {
        const check = checkStatusRestricted(drawing.sales_order_id);
        if (check.restricted) {
          errorToast(check.message);
          return;
        }
      }
    }
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
      formData.append('hsn_code', editData.hsn_code || '');
      formData.append('delivery_date', editData.delivery_date || '');
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
    contact_person: Yup.string().required('Contact Person is required'),
    phone_number: Yup.string()
      .matches(/^[0-9]{10}$/, {
        message: 'Phone number must be exactly 10 digits',
        excludeEmptyString: true
      })
      .required('Phone number is required'),
    email_address: Yup.string().email('Invalid email address').required('Email address is required'),
    customer_type: Yup.string().nullable(),
    gstin: Yup.string()
      .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
        message: 'Invalid GSTIN format',
        excludeEmptyString: true
      })
      .nullable(),
    city: Yup.string().nullable(),
    state: Yup.string().nullable(),
    billing_address: Yup.string().required('Billing Address is required'),
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
      manualDrawings: [getEmptyDrawingRow()],
    },
    validationSchema,
    onSubmit: async (values) => {
      console.log('Submitting Formik values:', values);
      if (formMode === 'edit' && editingRequirementId) {
        const check = checkStatusRestricted(editingRequirementId);
        if (check.restricted) {
          errorToast(check.message);
          return;
        }
      }
      try {
        let successCount = 0;
        setSubmitting(true);
        if (values.uploadMode === 'bulk') {
          const result = await saveSingleDrawing(values, false);
          if (result) {
            successToast(result.isExcelUpload ? `${result.count} Excel drawings imported successfully` : 'Drawing added successfully');
            successCount = result.isExcelUpload ? (result.count || 1) : 1;
            formik.resetForm({
              values: {
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
                manualDrawings: [getEmptyDrawingRow()],
              }
            });
            setShowFormModal(false);
            setClientLocked(false);
            if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
              window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
            }
          }
        } else {
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
              if (drawing.id && !String(drawing.id).includes('-')) {
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
                formData.append('hsn_code', drawing.hsn_code || '');
                formData.append('delivery_date', drawing.delivery_date || '');
                formData.append('drawing_type', drawing.drawing_type || 'Part');
                formData.append('remarks', drawing.remarks || '');
                // Append the list of kept existing files as JSON
                formData.append('existingFiles', JSON.stringify(drawing.existingFiles || []));

                // Append newly uploaded files
                if (drawing.files && drawing.files.length > 0) {
                  drawing.files.forEach(f => {
                    formData.append('drawing_pdf', f);
                  });
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
                await saveSingleDrawing({
                  ...values,
                  ...drawing,
                  salesOrderId: editingRequirementId
                }, false);
              }
              successCount++;
            }
            if (successCount > 0) {
              successToast(`Requirement updated successfully`);
            } else {
              warningToast('No valid drawings found to update');
            }
          } else {
            let sharedSalesOrderId = null;
            for (const drawing of values.manualDrawings) {
              if (!drawing.drawing_no) continue;
              const result = await saveSingleDrawing({
                ...values,
                ...drawing,
                salesOrderId: sharedSalesOrderId
              }, false);

              if (result && result.salesOrderId && !sharedSalesOrderId) {
                sharedSalesOrderId = result.salesOrderId;
              }
              successCount++;
            }

            if (successCount > 0) {
              successToast(`${successCount} drawings added successfully`);
            } else {
              warningToast('No drawings were added. Please fill in Drawing # and select a file for at least one row.');
            }
          }
        }

        if (formMode === 'edit' || successCount > 0) {
          setShowFormModal(false);
          setFormMode('add');
          setEditingRequirementId(null);
          setEditingRequirementData(null);
          setClientLocked(false);
          formik.resetForm({
            values: {
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
              manualDrawings: [getEmptyDrawingRow()],
            }
          });
          if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
            window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
          }
        }

        fetchDrawings(searchTerm);
        fetchRequirements();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const hasRealErrors = () => {
    const errorKeys = Object.keys(formik.errors);
    if (errorKeys.length === 0) return false;

    for (const key of errorKeys) {
      const errorVal = formik.errors[key];
      if (Array.isArray(errorVal)) {
        const hasElementErrors = errorVal.some(item => {
          if (!item) return false;
          if (typeof item === 'string') return true;
          if (typeof item === 'object') {
            return Object.values(item).some(val => !!val);
          }
          return false;
        });
        if (hasElementErrors) return true;
      } else if (errorVal) {
        return true;
      }
    }
    return false;
  };

  const getFormIncompleteReasons = () => {
    const reasons = [];

    // 1. Check top-level mandatory fields
    if (!formik.values.client_name?.trim()) reasons.push('Client Name');
    if (!formik.values.project_name?.trim()) reasons.push('Project Name');
    if (!formik.values.contact_person?.trim()) reasons.push('Contact Person');
    if (!formik.values.phone_number?.trim() || !/^[0-9]{10}$/.test(formik.values.phone_number)) {
      reasons.push('Phone (10 digits)');
    }
    if (!formik.values.email_address?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formik.values.email_address)) {
      reasons.push('Email Address');
    }
    if (!formik.values.billing_address?.trim()) reasons.push('Billing Address');

    // 2. Check drawing information based on uploadMode
    if (uploadMode === 'bulk') {
      if (!formik.values.file) reasons.push('Excel File');
    } else {
      if (!formik.values.manualDrawings || formik.values.manualDrawings.length === 0) {
        reasons.push('Drawing rows');
      } else {
        for (let i = 0; i < formik.values.manualDrawings.length; i++) {
          const drawing = formik.values.manualDrawings[i];
          if (!drawing.drawing_no?.trim()) reasons.push(`Drawing # (Row ${i + 1})`);
          if (!drawing.drawing_type?.trim()) reasons.push(`Type (Row ${i + 1})`);

          // Check if there is at least one file (either new or existing)
          const newFilesCount = drawing.files?.length || 0;
          const existingFilesCount = drawing.existingFiles?.length || 0;
          if (newFilesCount + existingFilesCount === 0) {
            reasons.push(`Attached File (Row ${i + 1})`);
          }
        }
      }
    }

    return reasons;
  };

  const isFormIncomplete = () => {
    const reasons = getFormIncompleteReasons();
    if (reasons.length > 0) {
      console.log('Customer Drawing Form Incomplete Reasons:', reasons);
      return true;
    }
    return false;
  };

  const generateNextProjectName = () => {
    const prefix = 'PRO-';
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^${prefix}${year}-(\\d{4})$`);

    let maxSeq = 0;
    requirements.forEach(req => {
      if (req.project_name) {
        const match = req.project_name.match(pattern);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}${year}-${nextSeq}`;
  };

  useEffect(() => {
    if (showFormModal && formMode === 'add') {
      const nextProjName = generateNextProjectName();
      if (formik.values.project_name !== nextProjName) {
        formik.setFieldValue('project_name', nextProjName);
      }
    }
  }, [showFormModal, formMode, requirements, formik.values.project_name]);

  // Auto-scroll to highlighted drawing row in either View or Edit modal
  useEffect(() => {
    if (showFormModal || showClientDrawingsModal) {
      const timer = setTimeout(() => {
        const highlightedEl = document.querySelector('.highlighted-drawing-row');
        if (highlightedEl) {
          highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showFormModal, showClientDrawingsModal, viewingClient, formik.values.manualDrawings]);

  // Keep uploadMode state in sync with formik
  useEffect(() => {
    formik.setFieldValue('uploadMode', uploadMode);
  }, [uploadMode]);

  // Reset form to clear stale/old data when entering add mode or closing form modal
  useEffect(() => {
    if (!showFormModal) {
      formik.resetForm({
        values: {
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
          manualDrawings: [getEmptyDrawingRow()],
        }
      });
      setClientLocked(false);
    }
  }, [showFormModal]);

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
    if (formMode === 'edit' && editingRequirementId) {
      const check = checkStatusRestricted(editingRequirementId);
      if (check.restricted) {
        errorToast(check.message);
        return;
      }
    }
    const newRow = getEmptyDrawingRow();
    formik.setFieldValue('manualDrawings', [newRow, ...formik.values.manualDrawings]);
  };

  const removeManualDrawingRow = (id) => {
    if (formMode === 'edit' && editingRequirementId) {
      const check = checkStatusRestricted(editingRequirementId);
      if (check.restricted) {
        errorToast(check.message);
        return;
      }
    }
    const drawingToRemove = formik.values.manualDrawings.find(d => d.id === id);

    // Track for deletion if it's an existing drawing (not a temp one)
    if (drawingToRemove && drawingToRemove.id && !String(drawingToRemove.id).includes('-')) {
      const isDesignInReview = formMode === 'edit' && editingRequirementData &&
        (editingRequirementData.status || '').toUpperCase().replace(/_/g, ' ').trim() === 'DESIGN IN REVIEW';
      const isRowLocked = isDesignInReview && drawingToRemove.status?.toUpperCase() === 'APPROVED';

      if (isRowLocked) {
        toast.error("Approved drawing cannot be edited.");
        return;
      }

      setDeletedDrawingIds(prev => [...prev, drawingToRemove.drawing_id || drawingToRemove.id]);
    }

    if (formik.values.manualDrawings.length > 1) {
      const updatedManualDrawings = formik.values.manualDrawings.filter(d => d.id !== id);
      formik.setFieldValue('manualDrawings', updatedManualDrawings);
    } else {
      // If it's the last row, clear it instead of removing it
      formik.setFieldValue('manualDrawings', [getEmptyDrawingRow()]);
    }
  };

  const handleManualFileChange = (e, id) => {
    if (formMode === 'edit' && editingRequirementId) {
      const check = checkStatusRestricted(editingRequirementId);
      if (check.restricted) {
        errorToast(check.message);
        return;
      }
    }
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const validFiles = [];
      const invalidFiles = [];

      for (const file of selectedFiles) {
        const ext = file.name.toLowerCase().split('.').pop();
        const isValid = file.type === 'application/pdf' ||
          file.type.startsWith('image/') ||
          ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'dxf', 'igs', 'stp', 'htp', 'prk'].includes(ext);
        if (isValid) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      }

      if (invalidFiles.length > 0) {
        errorToast(`Unsupported file types: ${invalidFiles.join(', ')}. Only PDF, images (.jpg, .jpeg, .png, .webp), and CAD files (.dxf, .igs, .stp, .htp, .prk) are allowed.`);
      }

      if (validFiles.length > 0) {
        const currentManualDrawings = formik.values.manualDrawings;
        const row = currentManualDrawings.find(d => d.id === id);
        if (row) {
          const currentFiles = row.files || [];
          handleManualDrawingChange(id, 'files', [...currentFiles, ...validFiles]);
        }
      }
      e.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, id) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const eTarget = { files };
      handleManualFileChange({ target: eTarget }, id);
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
    const firstFile = drawingData.file || (drawingData.files && drawingData.files[0]);
    const fileExt = firstFile ? firstFile.name.split('.').pop().toUpperCase() : '';
    const isExcel = fileExt === 'XLSX' || fileExt === 'XLS';

    // Removed mandatory file check as requested
    /*
    if (!firstFile) {
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

      formData.append('drawingNo', drawingData.drawing_no || (firstFile ? firstFile.name : 'BATCH_IMPORT'));
      formData.append('revision', drawingData.revision || '');
      formData.append('qty', drawingData.qty || 1);
      formData.append('description', drawingData.description || '');
      formData.append('hsn_code', drawingData.hsn_code || '');
      formData.append('delivery_date', drawingData.delivery_date || '');
      formData.append('drawing_type', drawingData.drawing_type || 'Part');
      formData.append('remarks', drawingData.remarks || '');
      formData.append('fileType', fileExt);
      if (drawingData.salesOrderId) {
        formData.append('salesOrderId', drawingData.salesOrderId);
      }
      if (drawingData.file) {
        formData.append('file', drawingData.file);
      } else if (drawingData.files && drawingData.files.length > 0) {
        drawingData.files.forEach(f => {
          formData.append('file', f);
        });
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
      const salesOrderId = savedDrawing.salesOrderId;
      const isExcelUpload = isExcel && savedDrawing.count;

      if (sendToDesign && drawingId) {
        await handleShareWithDesign(drawingId);
      } else if (isExcelUpload && sendToDesign) {
        await sendBulkUploadedToDesign(drawingData.client_name, savedDrawing.count);
      }

      return { drawingId, salesOrderId, isExcelUpload, count: savedDrawing.count };
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
    { label: 'Project Name', key: 'project_name', render: (val, row) => val || row.projectName || row.project_name || viewingClient?.projectName || '—' },
    { label: 'Description', key: 'drawing_description', render: (val, row) => val || row.drawing_description || row.description || row.item_description || '—' },
    { label: 'HSN Code', key: 'hsn_code', render: (val, row) => val || row.hsnCode || row.hsn_code || '—' },
    {
      label: 'Item Delivery',
      key: 'delivery_date',
      render: (val) => val ? new Date(val).toLocaleDateString('en-GB') : '—'
    },
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
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-center',
      render: (_, row) => (
        <button
          onClick={() => handleDelete(row.drawing_master_id || row.id)}
          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-all"
          title="Delete Drawing"
        >
          <Trash2 size={15} />
        </button>
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
    // If requirement is provided, use its specific items, otherwise fallback to global groupedDrawings
    let drawingsToConsider = [];
    if (requirement && requirement.original_items && requirement.original_items.length > 0) {
      drawingsToConsider = requirement.original_items;
    } else {
      drawingsToConsider = groupedDrawings[clientName] || [];
    }

    const unsharedDrawings = drawingsToConsider.filter(d =>
      !['SHARED', 'DESIGN_IN_REVIEW', 'APPROVED'].includes(d.status?.trim().toUpperCase())
    ) || [];

    const isCreatedStatus = requirement?.status?.trim().toUpperCase() === 'CREATED';

    if (unsharedDrawings.length === 0 && !isCreatedStatus) {
      infoToast('All drawings for this project are already shared and requirement is in progress.');
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
        setTimeout(() => fetchRequirements(), 1000);
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
    let parentIdOrStatus = viewingClient?.status || viewingClient?.requirementId;
    if (!parentIdOrStatus) {
      const drawing = drawings.find(d => d.id === id || d.drawing_master_id === id);
      parentIdOrStatus = drawing?.sales_order_id;
    }
    if (parentIdOrStatus) {
      const check = checkStatusRestricted(parentIdOrStatus);
      if (check.restricted) {
        errorToast(check.message);
        return;
      }
    }
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
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || errData.message || 'Delete failed');
        }
        successToast('Drawing has been deleted.');
        fetchDrawings(searchTerm);
        fetchRequirements();

        // Update local state if viewing in modal
        if (viewingClient) {
          setViewingClient(prev => ({
            ...prev,
            drawings: prev.drawings.filter(d => (d.drawing_master_id || d.id) !== id)
          }));
        }
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const handleViewClientDrawings = (client) => {
    // Handle both string (clientName) or object (row)
    const isRowObject = typeof client === 'object' && client !== null;
    const name = isRowObject ? (client.client_name || client.company_name) : client;
    const projectName = isRowObject ? client.project_name : null;
    const requirementId = isRowObject ? client.id : null;

    // If it's a row object from the requirements table, use its specific items
    let drawingsForClient = [];
    if (isRowObject && client.original_items) {
      drawingsForClient = client.original_items;
    } else if (requirementId) {
      const rawDrawings = drawings.filter(d =>
        normalize(d.client_name) === normalize(name) &&
        String(d.sales_order_id) === String(requirementId)
      );
      const seen = new Set();
      for (const d of rawDrawings) {
        const dNo = d.drawing_no ? String(d.drawing_no).trim().toLowerCase() : null;
        const dId = d.drawing_master_id || d.id;
        const key = dNo || (dId ? `id_${dId}` : d.id);
        if (key && !seen.has(key)) {
          seen.add(key);
          drawingsForClient.push(d);
        }
      }
    } else {
      // Use a case-insensitive search if direct match fails
      const clientObj = groupedDrawings[name] || {};
      if (Object.keys(clientObj).length === 0 && name) {
        const lowerName = name.toLowerCase().trim();
        const matchedClientKey = Object.keys(groupedDrawings).find(k => k.toLowerCase().trim() === lowerName);
        if (matchedClientKey) {
          const projectObj = groupedDrawings[matchedClientKey];
          if (projectName) {
            const lowerProj = projectName.toLowerCase().trim();
            const matchedProjKey = Object.keys(projectObj).find(pk => pk.toLowerCase().trim() === lowerProj);
            if (matchedProjKey) drawingsForClient = projectObj[matchedProjKey];
          } else {
            drawingsForClient = Object.values(projectObj).flat();
          }
        }
      } else if (projectName) {
        const lowerProj = projectName.toLowerCase().trim();
        const matchedProjKey = Object.keys(clientObj).find(pk => pk.toLowerCase().trim() === lowerProj);
        if (matchedProjKey) drawingsForClient = clientObj[matchedProjKey];
        else drawingsForClient = clientObj[projectName] || [];
      } else {
        drawingsForClient = Object.values(clientObj).flat();
      }
    }

    const viewData = {
      name: name,
      projectName: projectName,
      requirementId: requirementId,
      drawings: drawingsForClient
    };
    setViewingClient(viewData);
    setShowClientDrawingsModal(true);

    // Update URL behavior
    navigate(`${deptPrefix}/customer-drawing/view-draw?client_name=${encodeURIComponent(name)}${projectName ? `&project_name=${encodeURIComponent(projectName)}` : ''}${requirementId ? `&requirement_id=${requirementId}` : ''}`, {
      state: { type: 'view-client-drawings', data: viewData }
    });
  };

  const handleDeleteProject = async (projectId, projectName) => {
    const check = checkStatusRestricted(projectId);
    if (check.restricted) {
      errorToast(check.message);
      return;
    }
    const result = await Swal.fire({
      title: 'Delete Project?',
      text: `This will remove project "${projectName}" and all associated drawings. You won't be able to revert this!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete project'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/${projectId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || errData.message || 'Delete failed');
        }
        successToast('Project and associated drawings have been deleted.');
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
              formik.resetForm({
                values: {
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
                  manualDrawings: [getEmptyDrawingRow()],
                }
              });
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
            onSearchChange={setRequirementsSearchTerm}
            customFilter={(row, searchLower) => {
              return row.original_items?.some(item =>
                String(item.drawing_no || '').toLowerCase().includes(searchLower)
              );
            }}
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
          fetchDrawings(searchTerm);
          fetchRequirements();
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
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
                  <label className="block text-xs text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    disabled={modalMode === 'view'}
                    className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={editData.hsn_code}
                    onChange={(e) => setEditData({ ...editData, hsn_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Item Delivery</label>
                  <input
                    type="date"
                    disabled={modalMode === 'view'}
                    className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={editData.delivery_date || ''}
                    onChange={(e) => setEditData({ ...editData, delivery_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Qty</label>
                  <input
                    type="number"
                    disabled={modalMode === 'view'}
                    className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={editData.qty}
                    onChange={(e) => setEditData({ ...editData, qty: parseFloat(e.target.value) || 0 })}
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
                  <label className="block text-xs text-slate-700 mb-1">Update Drawing Image</label>
                  <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded p-2 hover:border-indigo-400 transition-colors bg-white cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            errorToast('Only image files are allowed');
                            e.target.value = '';
                            return;
                          }
                          setEditData({ ...editData, drawing_pdf: file });
                        }
                      }}
                    />
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <p className="mt-1 text-xs text-slate-500">{editData.drawing_pdf ? editData.drawing_pdf.name : 'Click to update image'}</p>
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
                    View Current Image
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
          formik.resetForm({
            values: {
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
              manualDrawings: [getEmptyDrawingRow()],
            }
          });
          setClientLocked(false);
          if (location.pathname !== `${deptPrefix}/customer-drawing`) {
            window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
          }
          fetchDrawings(searchTerm);
          fetchRequirements();
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
                readOnly
                placeholder="Project Name"
                className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 cursor-not-allowed text-slate-600 font-semibold"
                value={formik.values.project_name}
              />
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
              <label className="block text-xs  text-slate-700 mb-1">Type</label>
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
              <label className="block text-xs  text-slate-700 mb-1">City</label>
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
              <label className="block text-xs  text-slate-700 mb-1">State</label>
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
                      <th className="p-2 text-left text-xs   text-slate-500  ">HSN Code</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Item Delivery</th>
                      <th className="p-2 text-left text-xs   text-slate-500   w-16">Rev</th>
                      <th className="p-2 text-left text-xs   text-slate-500   w-16">Qty</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">File *</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Type *</th>
                      <th className="p-2 text-left text-xs   text-slate-500  ">Notes</th>
                      <th className="p-2 text-center text-xs   text-slate-500   w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {(() => {
                      const isDesignInReview = formMode === 'edit' && editingRequirementData &&
                        (editingRequirementData.status || '').toUpperCase().replace(/_/g, ' ').trim() === 'DESIGN IN REVIEW';

                      return formik.values.manualDrawings.map((drawing, index) => {
                        const query = requirementsSearchTerm?.trim().toLowerCase();
                        const isHighlighted = query && drawing.drawing_no && String(drawing.drawing_no).trim().toLowerCase().includes(query);
                        const isRowLocked = isDesignInReview && drawing.status?.toUpperCase() === 'APPROVED';

                        return (
                          <tr key={drawing.id} className={`${isHighlighted ? 'highlighted-drawing-row' : ''} ${isRowLocked ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  {isRowLocked && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" title="Approved & Locked" />}
                                  <input
                                    type="text"
                                    disabled={isRowLocked}
                                    name={`manualDrawings[${index}].drawing_no`}
                                    placeholder="DRW-1001"
                                    className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : ((formik.touched.manualDrawings?.[index]?.drawing_no || formik.submitCount > 0) && formik.errors.manualDrawings?.[index]?.drawing_no ? 'border-red-500' : 'border-slate-300')}`}
                                    value={drawing.drawing_no}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                  />
                                </div>
                                {((formik.touched.manualDrawings?.[index]?.drawing_no || formik.submitCount > 0) && formik.errors.manualDrawings?.[index]?.drawing_no) && (
                                  <div className="text-red-500 text-[10px] mt-0.5">{formik.errors.manualDrawings[index].drawing_no}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <input
                                type="text"
                                disabled={isRowLocked}
                                name={`manualDrawings[${index}].description`}
                                placeholder="Aluminum Frame"
                                className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300'}`}
                                value={drawing.description}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                              />
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <input
                                type="text"
                                disabled={isRowLocked}
                                name={`manualDrawings[${index}].hsn_code`}
                                placeholder="HSN Code"
                                className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300'}`}
                                value={drawing.hsn_code}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                              />
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <input
                                type="date"
                                disabled={isRowLocked}
                                name={`manualDrawings[${index}].delivery_date`}
                                className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300'}`}
                                value={drawing.delivery_date}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                              />
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <input
                                type="text"
                                disabled={isRowLocked}
                                name={`manualDrawings[${index}].revision`}
                                placeholder="A"
                                className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-center ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300'}`}
                                value={drawing.revision}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                              />
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <input
                                type="number"
                                disabled={isRowLocked}
                                name={`manualDrawings[${index}].qty`}
                                min="1"
                                step="any"
                                className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-center ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300'}`}
                                value={drawing.qty}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveDrawingIdForFiles(drawing.id)}
                                  className={`p-1.5 rounded border text-xs font-semibold flex items-center justify-center gap-1 transition-all mx-auto shadow-sm ${((formik.submitCount > 0 && ((drawing.existingFiles?.length || 0) + (drawing.files?.length || 0)) === 0) ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' : (isRowLocked ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'))}`}
                                  title={((drawing.existingFiles?.length || 0) + (drawing.files?.length || 0)) === 0 ? 'Choose Files' : `${(drawing.existingFiles?.length || 0) + (drawing.files?.length || 0)} File(s)`}
                                >
                                  {isRowLocked ? (
                                    <Lock className="w-3.5 h-3.5" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                  )}
                                  {((drawing.existingFiles?.length || 0) + (drawing.files?.length || 0)) > 0 && (
                                    <span className={`text-[10px] rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center font-bold ${isRowLocked ? 'bg-slate-400 text-white' : 'bg-emerald-600 text-white'}`}>
                                      {(drawing.existingFiles?.length || 0) + (drawing.files?.length || 0)}
                                    </span>
                                  )}
                                </button>
                                {formik.submitCount > 0 && ((drawing.existingFiles?.length || 0) + (drawing.files?.length || 0)) === 0 && (
                                  <span className="text-red-500 text-[10px] mt-0.5 block text-center font-medium">Required</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <div className="flex flex-col">
                                <select
                                  disabled={isRowLocked}
                                  name={`manualDrawings[${index}].drawing_type`}
                                  className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : ((formik.touched.manualDrawings?.[index]?.drawing_type || formik.submitCount > 0) && formik.errors.manualDrawings?.[index]?.drawing_type ? 'border-red-500' : 'border-slate-300')}`}
                                  value={drawing.drawing_type || 'Part'}
                                  onChange={formik.handleChange}
                                  onBlur={formik.handleBlur}
                                >
                                  <option value="Part">Part</option>
                                  <option value="Assembly">Assembly</option>
                                </select>
                                {((formik.touched.manualDrawings?.[index]?.drawing_type || formik.submitCount > 0) && formik.errors.manualDrawings?.[index]?.drawing_type) && (
                                  <div className="text-red-500 text-[10px] mt-0.5">{formik.errors.manualDrawings[index].drawing_type}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2" onClick={isRowLocked ? () => toast.error("Approved drawing cannot be edited.") : undefined}>
                              <input
                                type="text"
                                disabled={isRowLocked}
                                name={`manualDrawings[${index}].remarks`}
                                placeholder="Notes..."
                                className={`w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isRowLocked ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300'}`}
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
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* BULK MODE */
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs  text-slate-700 mb-2">Excel File <span className="text-red-500">*</span></label>
                <div className={`flex items-center justify-center border-2 border-dashed rounded  p-2 hover:border-indigo-400 transition-colors bg-slate-50 cursor-pointer ${(formik.touched.file || formik.submitCount > 0) && formik.errors.file ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}>
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
                {(formik.touched.file || formik.submitCount > 0) && formik.errors.file && (
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

          <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1 max-w-[65%]">
              {getFormIncompleteReasons().length > 0 && (
                <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 flex items-center gap-1 shadow-sm">
                  <span className="font-semibold shrink-0">Required:</span>
                  <span className="text-slate-600 font-medium">{getFormIncompleteReasons().join(', ')}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  formik.resetForm({
                    values: {
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
                      manualDrawings: [getEmptyDrawingRow()],
                    }
                  });
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
                disabled={submitting || isFormIncomplete()}
                className="px-6 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 transition-colors flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <Send className="w-3 h-3" />
                {formMode === 'edit' ? (submitting ? 'Updating...' : 'Update Requirement') : (uploadMode === 'bulk' ? 'Upload Excel' : 'Add Requirements')}
              </button>
            </div>
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
          fetchDrawings(searchTerm);
          fetchRequirements();
        }}
        title={viewingClient ? (
          <div className="flex flex-col">
            <span>Drawings for {viewingClient.name}</span>
            {viewingClient.projectName && (
              <span className="text-xs text-slate-500 font-normal">Project: {viewingClient.projectName}</span>
            )}
          </div>
        ) : 'Client Drawings'}
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
                rowClassName={(row) => {
                  const query = requirementsSearchTerm?.trim().toLowerCase();
                  if (query && row.drawing_no && String(row.drawing_no).trim().toLowerCase().includes(query)) {
                    return 'highlighted-drawing-row';
                  }
                  return '';
                }}
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  setShowClientDrawingsModal(false);
                  if (window.location.pathname !== `${deptPrefix}/customer-drawing`) {
                    window.history.pushState({}, '', `${deptPrefix}/customer-drawing`);
                  }
                  fetchDrawings(searchTerm);
                  fetchRequirements();
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

      {/* Drawing Attachments Modal */}
      {activeDrawingIdForFiles && (() => {
        const activeDrawing = formik.values.manualDrawings.find(d => d.id === activeDrawingIdForFiles);
        if (!activeDrawing) return null;

        const isDesignInReview = formMode === 'edit' && editingRequirementData &&
          (editingRequirementData.status || '').toUpperCase().replace(/_/g, ' ').trim() === 'DESIGN IN REVIEW';
        const isActiveDrawingLocked = isDesignInReview && activeDrawing && activeDrawing.status?.toUpperCase() === 'APPROVED';

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl border border-slate-100 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-300">
              {/* Modal Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    {isActiveDrawingLocked ? (
                      <Lock className="w-5 h-5 text-slate-500" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Drawing Attachments & Documents</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">Drawing #: {activeDrawing.drawing_no || 'New Drawing'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDrawingIdForFiles(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
                {/* Currently Attached Files */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currently Attached Files</h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                    {((activeDrawing.existingFiles || []).length + (activeDrawing.files || []).length) > 0 ? (
                      <div className="divide-y divide-slate-100 bg-white">
                        {/* Existing Files */}
                        {(activeDrawing.existingFiles || []).map((filePath, fileIdx) => {
                          const fileName = filePath.split('/').pop().replace(/^\d+-/, '');
                          return (
                            <div key={`exist-${fileIdx}`} className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-all group">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-105 transition-all">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate max-w-[320px]" title={fileName}>{fileName}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Uploaded drawing file</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewDrawing({ ...activeDrawing, drawing_pdf: filePath });
                                    setShowPreviewModal(true);
                                  }}
                                  className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Preview Document"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isActiveDrawingLocked) {
                                      toast.error("Approved drawing cannot be edited.");
                                      return;
                                    }
                                    const updated = activeDrawing.existingFiles.filter((_, idx) => idx !== fileIdx);
                                    handleManualDrawingChange(activeDrawing.id, 'existingFiles', updated);
                                  }}
                                  className={`p-1.5 rounded-lg transition-all ${isActiveDrawingLocked ? 'text-slate-300 hover:bg-transparent cursor-not-allowed' : 'text-rose-500 hover:bg-rose-50'}`}
                                  title={isActiveDrawingLocked ? "Approved drawing cannot be edited." : "Delete Document"}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* New Files */}
                        {(activeDrawing.files || []).map((fileObj, fileIdx) => {
                          const fileName = fileObj.name;
                          return (
                            <div key={`new-${fileIdx}`} className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-all group">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-105 transition-all">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-emerald-700 truncate max-w-[320px]" title={fileName}>{fileName}</p>
                                  <p className="text-[10px] text-emerald-500 mt-0.5">Staged for upload</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const localUrl = URL.createObjectURL(fileObj);
                                    setPreviewDrawing({ ...activeDrawing, drawing_pdf: localUrl, file_type: fileObj.type.split('/')[1]?.toUpperCase() });
                                    setShowPreviewModal(true);
                                  }}
                                  className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Preview staged file"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isActiveDrawingLocked) {
                                      toast.error("Approved drawing cannot be edited.");
                                      return;
                                    }
                                    const updated = activeDrawing.files.filter((_, idx) => idx !== fileIdx);
                                    handleManualDrawingChange(activeDrawing.id, 'files', updated);
                                  }}
                                  className={`p-1.5 rounded-lg transition-all ${isActiveDrawingLocked ? 'text-slate-300 hover:bg-transparent cursor-not-allowed' : 'text-rose-500 hover:bg-rose-50'}`}
                                  title={isActiveDrawingLocked ? "Approved drawing cannot be edited." : "Remove staged file"}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-white">
                        <div className="inline-flex p-3 bg-slate-50 text-slate-400 rounded-full mb-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">No attachments uploaded yet</p>
                        <p className="text-[10px] text-slate-400 mt-1">Add PDF drawings or image files below to attach them</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload New Files</h4>
                  {isActiveDrawingLocked ? (
                    <div
                      onClick={() => toast.error("Approved drawing cannot be edited.")}
                      className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl p-6 text-center cursor-not-allowed flex flex-col items-center justify-center"
                    >
                      <div className="inline-flex p-3 bg-white text-slate-300 rounded-lg shadow-sm border border-slate-100 mb-3">
                        <Lock className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-400">File replacement disabled</p>
                      <p className="text-[10px] text-slate-400 mt-1">This drawing is approved and its files cannot be changed</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById('attachmentsInput').click()}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, activeDrawing.id)}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 rounded-xl p-6 text-center cursor-pointer transition-all group"
                    >
                      <input
                        type="file"
                        id="attachmentsInput"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.dxf,.igs,.stp,.htp,.prk,image/*,application/pdf"
                        onChange={(e) => handleManualFileChange(e, activeDrawing.id)}
                        className="hidden"
                      />
                      <div className="inline-flex p-3 bg-white text-slate-500 group-hover:text-indigo-500 rounded-lg shadow-sm border border-slate-100 group-hover:scale-105 transition-all mb-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-700">Drag & drop or click to upload</p>
                      <p className="text-[10px] text-slate-400 mt-1">Supports PDF drawings, image files, and CAD files up to 10MB each</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setActiveDrawingIdForFiles(null)}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CustomerDrawing;

