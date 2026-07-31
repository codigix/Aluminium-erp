import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, DataTable, Modal, SearchableSelect, MultiSelect, Button, Tabs } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { getFileUrl } from '../utils/url';
import {
  Eye,
  Mail,
  FileText,
  FilePlus,
  Pencil,
  Check,
  Trash2,
  Plus,
  ChevronRight,
  RefreshCw,
  Filter,
  Download,
  Upload,
  Search,
  Loader2,
  Activity,
  Clock,
  CheckCircle2,
  Send,
  History,
  Building2,
  Printer
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';
import RFQPrintDetail from './RFQPrintDetail.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const rfqStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  RFQ_REQUESTED: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'RFQ Requested' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  EMAIL_RECEIVED: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', badge: 'bg-sky-100 text-sky-700', label: 'Email Received' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Received' },
  REVIEWED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700', label: 'Approved' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Closed' },
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  REJECTED: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700', label: 'REJECTED' },
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

const getCorrectMaterialType = (itemCode, currentType) => {
  const code = (itemCode || '').toUpperCase().trim();
  if (code.startsWith('RM-') || code.startsWith('RM ') || code.startsWith('RM_')) return 'RAW_MATERIAL';
  if (code.startsWith('PAC-') || code.startsWith('PAC ') || code.startsWith('PAC_')) return 'PACKING_MATERIAL';
  if (code.startsWith('CON-') || code.startsWith('CON ') || code.startsWith('CON_')) return 'CONSUMABLE';
  if (code.startsWith('MRO-') || code.startsWith('MRO ') || code.startsWith('MRO_')) return 'MRO';
  if (code.startsWith('BOU-') || code.startsWith('BO-') || code.startsWith('BO ') || code.startsWith('BO_')) return 'BOUGHT_OUT';
  return currentType || 'RAW_MATERIAL';
};

const daysValid = (validUntil) => {
  if (!validUntil) return null;
  const today = new Date();
  const valid = new Date(validUntil);
  const diff = Math.ceil((valid - today) / (1000 * 60 * 60 * 24));
  return diff;
};

const Quotations = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.endsWith('/received') || path.endsWith('/record')) return 'received';
    return 'sent';
  }, [location.pathname]);

  const [quotations, setQuotations] = useState([]);
  const [rawRfqs, setRawRfqs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All Quotations');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [hostCompanies, setHostCompanies] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedHostCompany, setSelectedHostCompany] = useState(null);

  const [formData, setFormData] = useState({
    vendorId: '',
    vendorIds: [],
    salesOrderId: '',
    rfq_id: null,
    validUntil: '',
    notes: '',
    hostCompanyId: '',
    gstPercentage: 18,
    items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
  });
  const [recordData, setRecordData] = useState({
    projectId: '',
    vendorId: '',
    quotationId: '',
    amount: 0,
    gstPercentage: 18,
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
    hostCompanyId: '',
    gstPercentage: 18,
    items: []
  });

  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [selectedMR, setSelectedMR] = useState('');
  const [selectedAwards, setSelectedAwards] = useState({});
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareData, setCompareData] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalModalQuote, setApprovalModalQuote] = useState(null);
  const [approvalModalItems, setApprovalModalItems] = useState([]);

  const [showUploadAttachmentsModal, setShowUploadAttachmentsModal] = useState(false);
  const [uploadModalFiles, setUploadModalFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [recordFiles, setRecordFiles] = useState([]);
  const [openDownloadMenuId, setOpenDownloadMenuId] = useState(null);
  const [editAttachments, setEditAttachments] = useState([]);
  const [editUploadFiles, setEditUploadFiles] = useState([]);
  const [itemVendorMap, setItemVendorMap] = useState({});

  useEffect(() => {
    setSelectedQuotes([]);
    setSelectedMR('');
  }, [activeTab, filterStatus]);

  useEffect(() => {
    if (showCompareModal && compareData.length > 0) {
      const initialAwards = {};
      const uniqueItemCodes = Array.from(new Set(compareData.flatMap(q => (q.items || []).map(item => item.item_code || item.drawing_no))));

      uniqueItemCodes.forEach(itemCode => {
        let cheapestQuoteId = null;
        let cheapestRate = Infinity;

        compareData.forEach(q => {
          const item = (q.items || []).find(it => (it.item_code || it.drawing_no) === itemCode);
          if (item && parseFloat(item.unit_rate) < cheapestRate) {
            cheapestRate = parseFloat(item.unit_rate);
            cheapestQuoteId = q.id;
          }
        });

        if (cheapestQuoteId) {
          initialAwards[itemCode] = cheapestQuoteId;
        }
      });
      setSelectedAwards(initialAwards);
    }
  }, [showCompareModal, compareData]);

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

  const fetchStockItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStockItems(data);
      }
    } catch (err) {
      console.error('Error fetching stock items:', err);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchRawRfqs();
    fetchStats();
    fetchVendors();
    fetchSalesOrders();
    fetchMaterialRequests();
    fetchHostCompanies();
    fetchStockItems();
  }, []);

  const fetchHostCompanies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/admin-company-master`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHostCompanies(data);
        if (!selectedHostId) {
          const active = data.find(c => c.status === 'ACTIVE');
          if (active) {
            setSelectedHostId(String(active.id));
            setSelectedHostCompany(active);
            setFormData(prev => ({ ...prev, hostCompanyId: active.id }));
          } else if (data.length > 0) {
            setSelectedHostId(String(data[0].id));
            setSelectedHostCompany(data[0]);
            setFormData(prev => ({ ...prev, hostCompanyId: data[0].id }));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching host companies:', err);
    }
  };

  useEffect(() => {
    if (selectedHostId && hostCompanies.length > 0) {
      const matched = hostCompanies.find(h => String(h.id) === String(selectedHostId));
      setSelectedHostCompany(matched || null);
      setFormData(prev => ({ ...prev, hostCompanyId: selectedHostId }));
    }
  }, [selectedHostId, hostCompanies]);

  const fetchRawRfqs = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/rfqs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRawRfqs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching raw RFQs:', error);
    }
  };

  useEffect(() => {
    const path = location.pathname;

    if (path.endsWith('/quotations/request')) {
      if (!showCreateModal) {
        if (!location.state?.fromRFQ) {
          setFormData({
            vendorId: '',
            vendorIds: [],
            salesOrderId: '',
            rfq_id: null,
            validUntil: '',
            notes: '',
            items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
          });
        }
        setShowCreateModal(true);
      }
    } else if (path.endsWith('/quotations/record')) {
      if (!showCreateModal) {
        if (!location.state?.fromRFQ) {
          setRecordData({
            projectId: '',
            vendorId: '',
            quotationId: '',
            amount: 0,
            validUntil: '',
            items: [],
            notes: '',
            recordFile: null
          });
        }
        setShowCreateModal(true);
      }
    } else if (path.endsWith('/quotations/received')) {
      if (showCreateModal) {
        setShowCreateModal(false);
      }
      return;
    } else if (path.endsWith('/quotations')) {
      if (showCreateModal) {
        setShowCreateModal(false);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    const mrId = searchParams.get('mr');
    const rfqId = searchParams.get('rfq');

    if (mrId && materialRequests.length > 0) {
      handleSalesOrderChange({ target: { value: `MR-${mrId}` } });
      setSearchParams({});
      navigate(`${deptPrefix}/quotations/request`, { state: { fromRFQ: true }, replace: true });
    } else if (rfqId && rawRfqs.length > 0) {
      const rfq = rawRfqs.find(r => String(r.id) === String(rfqId));
      if (rfq) {
        openRFQSendModal(rfq);
      }
      setSearchParams({});
    }
  }, [searchParams, materialRequests, rawRfqs]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setQuotations([]); // Clear stale data
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
        // Filter to show relevant MRs for procurement (e.g., DRAFT, Approved )
        setMaterialRequests(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching material requests:', error);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, planned_qty: 0, uom: 'NOS', unit_rate: 0 }]
    });
  };

  const handleSalesOrderChange = async (e) => {
    const value = e.target.value;

    // Clear items if nothing selected
    if (!value) {
      setFormData(prev => ({
        ...prev,
        salesOrderId: '',
        items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, planned_qty: 0, uom: 'NOS', unit_rate: 0 }]
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
              const code = (item.item_code || item.drawing_no || '').toUpperCase().trim();
              return !['FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY'].includes(type) && !code.startsWith('ASSEMBLY');
            })
            .map(item => ({
              drawing_no: item.item_code || '—',
              material_name: item.name || item.material_name || '',
              material_type: getCorrectMaterialType(item.item_code || item.drawing_no, item.material_type),
              design_qty: parseFloat(item.quantity) || parseFloat(item.design_qty) || 0, // Prefer requested quantity
              planned_qty: parseFloat(item.design_qty) || 0, // Keep actual design qty as planned_qty
              quantity: parseFloat(item.quantity) || parseFloat(item.design_qty) || 0,
              uom: item.uom || 'NOS',
              unit_rate: item.unit_rate || item.rate || 0,
              length: item.length || 0,
              width: item.width || 0,
              thickness: item.thickness || 0,
              diameter: item.diameter || 0,
              outer_diameter: item.outer_diameter || 0,
              density: item.density || 0,
              weight_per_unit: item.weight_per_unit || 0,
              shape_type: item.shape_type || item.shape_name || item.shape || '',
              shape_name: item.shape_name || item.shape_type || item.shape || ''
            }));

          setFormData(prev => ({
            ...prev,
            items: mrItems.length > 0 ? mrItems : [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, planned_qty: 0, uom: 'NOS', unit_rate: 0 }]
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
            const code = (req.drawing_no || req.item_code || '').toUpperCase().trim();
            return !['FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY'].includes(type) && !code.startsWith('ASSEMBLY');
          })
          .map(req => {
            const shortage = parseFloat(req.shortage) || 0;
            const totalRequired = parseFloat(req.total_required) || 0;
            const finalQty = shortage > 0 ? shortage : totalRequired;

            return {
              drawing_no: req.drawing_no || '—',
              material_name: req.material_name || '',
              material_type: getCorrectMaterialType(req.drawing_no || req.item_code, req.material_type),
              design_qty: totalRequired, // Use engineering spec as "Design Qty"
              planned_qty: totalRequired, // Keep total required as reference
              quantity: finalQty,
              uom: req.uom || 'NOS',
              unit_rate: parseFloat(req.rate || req.unit_rate) || 0,
              has_laser_cutting: Boolean(req.has_laser_cutting),
              laser_cutting: req.laser_cutting || 'With Material'
            };
          });

        setFormData(prev => ({
          ...prev,
          items: materialItems.length > 0 ? materialItems : [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, planned_qty: 0, uom: 'NOS', unit_rate: 0 }]
        }));
      }
    } catch (error) {
      console.error('Error fetching material requirements:', error);
    }
  };

  const getAvailableVendors = () => {
    if (formData.vendorIds && formData.vendorIds.length > 0) {
      return vendors.filter(v => formData.vendorIds.map(String).includes(String(v.id)));
    }
    return vendors;
  };

  useEffect(() => {
    const selectedIds = formData.vendorIds || [];
    if (selectedIds.length === 0) return;

    let changed = false;
    const updatedItems = (formData.items || []).map(item => {
      const currentItemVendors = item.vendorIds || [];
      let nextItemVendors = currentItemVendors.filter(vId => selectedIds.map(String).includes(String(vId)));

      if (nextItemVendors.length === 0 && selectedIds.length > 0) {
        nextItemVendors = [...selectedIds];
      } else if (selectedIds.length === 1 && (nextItemVendors.length !== 1 || String(nextItemVendors[0]) !== String(selectedIds[0]))) {
        nextItemVendors = [...selectedIds];
      }

      if (JSON.stringify(currentItemVendors.map(String).sort()) !== JSON.stringify(nextItemVendors.map(String).sort())) {
        changed = true;
        return { ...item, vendorIds: nextItemVendors };
      }
      return item;
    });

    if (changed) {
      setFormData(prev => ({ ...prev, items: updatedItems }));
    }
  }, [formData.vendorIds, formData.items]);

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;

    if (field === 'drawing_no' || field === 'item_code') {
      newItems[index].material_type = getCorrectMaterialType(value, newItems[index].material_type);
    }

    // Always sync quantity with design_qty if it's the one being changed
    if (field === 'design_qty') {
      newItems[index].quantity = value;
    }

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
            const code = (item.item_code || item.drawing_no || '').toUpperCase().trim();
            return !['FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY'].includes(type) && !code.startsWith('ASSEMBLY');
          });

          const loadedGst = detailedQuotation.gst_percentage !== undefined && detailedQuotation.gst_percentage !== null
            ? parseFloat(detailedQuotation.gst_percentage)
            : 18;

          setRecordData({
            ...recordData,
            vendorId,
            quotationId: quotation.id,
            gstPercentage: loadedGst,
            items: filteredItems.map(item => ({
              ...item,
              unit_rate: 0,
              amount: 0,
              material_type: getCorrectMaterialType(item.item_code || item.drawing_no, item.material_type)
            })),
            amount: 0,
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
        gstPercentage: 18,
        items: [],
        amount: 0,
        notes: ''
      });
    }
  };

  const handleRecordItemChange = (index, field, value) => {
    const newItems = [...recordData.items];
    newItems[index][field] = value;

    if (field === 'drawing_no' || field === 'item_code') {
      newItems[index].material_type = getCorrectMaterialType(value, newItems[index].material_type);
    }

    const getItemDesignQty = (item) => {
      if (item.planned_qty !== null && item.planned_qty !== undefined && item.planned_qty !== '') {
        return parseFloat(item.planned_qty) || 0;
      }
      return parseFloat(item.design_qty || item.quantity) || 0;
    };

    // Recalculate item amount
    if (field === 'quantity' || field === 'unit_rate' || field === 'design_qty' || field === 'planned_qty') {
      if (field === 'design_qty') {
        newItems[index].quantity = value;
      }

      const qty = getItemDesignQty(newItems[index]);
      const rate = parseFloat(newItems[index].unit_rate) || 0;
      newItems[index].amount = qty * rate;
    }

    // Recalculate total amount (subtotal)
    const totalAmount = newItems.reduce((sum, item) => {
      const qty = getItemDesignQty(item);
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
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setRecordFiles(prev => [...prev, ...selectedFiles]);
    const file = selectedFiles[0];

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
      items: [...recordData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, planned_qty: 0, uom: 'NOS', unit_rate: 0 }]
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

  const handleCreateQuotation = async (e, forcedStatus = null) => {
    if (e) e.preventDefault();

    const headerVendorIds = formData.vendorIds || [];
    const itemVendorIds = [];
    (formData.items || []).forEach(item => {
      if (item.vendorIds) {
        item.vendorIds.forEach(vId => {
          if (vId && !itemVendorIds.includes(String(vId))) {
            itemVendorIds.push(String(vId));
          }
        });
      }
    });

    const allVendorIds = Array.from(new Set([...headerVendorIds.map(String), ...itemVendorIds]));

    if (allVendorIds.length === 0) {
      errorToast('At least one vendor is required');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      setLoading(true);

      const rfqGroupId = `GRP-${Date.now()}`;

      // Creation sequentially to avoid DB deadlocks
      for (const vId of allVendorIds) {
        const vendorItems = (formData.items || []).filter(item => {
          const itemVendors = item.vendorIds || [];
          if (itemVendors.length > 0) {
            return itemVendors.map(String).includes(String(vId));
          }
          return headerVendorIds.map(String).includes(String(vId));
        });

        if (vendorItems.length === 0) continue;

        const payload = {
          ...formData,
          vendorId: parseInt(vId),
          validUntil: formData.validUntil || null,
          gst_percentage: formData.gstPercentage !== '' && formData.gstPercentage !== undefined ? parseFloat(formData.gstPercentage) : 18,
          status: forcedStatus || 'SENT',
          rfq_group_id: rfqGroupId,
          items: vendorItems
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

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Failed to create quotation for vendor ID ${vId}`);
        }
      }

      successToast(`Successfully created RFQs for ${allVendorIds.length} vendor(s)`);
      navigate(`${deptPrefix}/quotations`);
      setFormData({
        vendorId: '',
        vendorIds: [],
        salesOrderId: '',
        rfq_id: null,
        validUntil: '',
        notes: '',
        hostCompanyId: '',
        gstPercentage: 18,
        items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
      });

      // Refresh data
      fetchQuotations();
      fetchRawRfqs();
      fetchStats();
    } catch (error) {
      console.error('RFQ Creation Error:', error);
      errorToast(error.message || 'Failed to create quotations');
    } finally {
      setLoading(false);
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
          notes: recordData.notes,
          gst_percentage: recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18,
          status: 'RECEIVED'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to record quote details');
      }
      const result = await response.json();
      const actualQuotationId = result.data?.id || recordData.quotationId;

      // 2. Upload files if present
      if (recordFiles.length > 0) {
        const fileFormData = new FormData();
        recordFiles.forEach(file => {
          fileFormData.append('pdf', file);
        });

        const uploadRes = await fetch(`${API_BASE}/quotations/${actualQuotationId}/upload-response`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: fileFormData
        });

        if (!uploadRes.ok) throw new Error('Failed to upload vendor PDFs');
      } else {
        // If no file, manually update status to RECEIVED (upload endpoint does this automatically if file present)
        await fetch(`${API_BASE}/quotations/${actualQuotationId}/status`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'RECEIVED' })
        });
      }

      successToast('Quote details recorded successfully');
      navigate(`${deptPrefix}/quotations`);
      setRecordData({ projectId: '', vendorId: '', quotationId: '', amount: 0, gstPercentage: 18, validUntil: '', items: [], notes: '', recordFile: null });
      setRecordFiles([]);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to record quote');
    }
  };

  const handleViewPDF = async (quotationId) => {
    // Synchronously open tab before async fetch to prevent popup blocker
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<div style="font-family:sans-serif;padding:30px;text-align:center;color:#475569;"><h3>Generating RFQ PDF Document...</h3><p>Please wait a moment.</p></div>');
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (printWindow) printWindow.close();
        throw new Error('Failed to fetch PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      if (printWindow && !printWindow.closed) {
        printWindow.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = `RFQ_${quotationId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close();
      errorToast('Could not view PDF');
      console.error(error);
    }
  };

  const handleDownloadPDF = async (quotationId, quoteNumber) => {
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
      const link = document.createElement('a');
      link.href = url;
      link.download = `RFQ_${quoteNumber || quotationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      errorToast('Could not download PDF');
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

  const handleApproveQuoteClick = async (quotationId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch quotation details');

      const qData = await response.json();
      setApprovalModalQuote(qData);
      setApprovalModalItems(qData.items || []);
      setShowApprovalModal(true);
    } catch (error) {
      errorToast(error.message || 'Could not load quotation details');
      console.error(error);
    }
  };

  const handleApprovalAction = async (quotationId, action) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: action })
      });

      if (!response.ok) throw new Error(`Failed to update status to ${action}`);

      successToast(`Quote ${action === 'REVIEWED' ? 'approved' : 'rejected'} successfully`);
      setShowApprovalModal(false);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update quote status');
    }
  };

  const handleBulkApproveCompared = async () => {
    const result = await Swal.fire({
      title: 'Approve Selected Awards?',
      text: 'This will approve the selected vendors for each item and automatically generate Purchase Orders.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Approve & Create POs',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const quotationIds = compareData.map(q => q.id);

      const awards = Object.entries(selectedAwards).map(([itemCode, quotationId]) => ({
        itemCode,
        quotationId
      }));

      const response = await fetch(`${API_BASE}/quotations/compare/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quotationIds,
          awards
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve comparison');
      }

      successToast('Comparison approved and Purchase Orders created successfully!');
      setShowCompareModal(false);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      console.error('Bulk Approve Error:', error);
      errorToast(error.message || 'Failed to approve comparison');
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
        throw new Error(errData.message || errData.error || 'Failed to delete quotation');
      }

      successToast('Quotation deleted successfully');
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete quotation');
    }
  };

  const handleDeleteRFQ = async (rfqId) => {
    const result = await Swal.fire({
      title: 'Delete RFQ Request?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/rfqs/${rfqId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to delete RFQ');
      }

      successToast('RFQ deleted successfully');
      fetchRawRfqs();
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to delete RFQ');
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

    // When recording response, start with zero rates
    const freshItems = (q.items || []).map(item => ({
      ...item,
      unit_rate: 0,
      amount: 0
    }));

    setRecordData({
      projectId: projectId,
      vendorId: String(q.vendor_id),
      quotationId: q.id,
      amount: 0,
      validUntil: q.valid_until ? new Date(q.valid_until).toISOString().split('T')[0] : '',
      items: freshItems,
      notes: q.notes || `Response to ${q.quote_number}`,
      recordFile: null
    });
    navigate(`${deptPrefix}/quotations/record`, { state: { fromRFQ: true } });
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

    const paths = quotation.received_pdf_path
      ? quotation.received_pdf_path.split(',').map(p => p.trim()).filter(Boolean)
      : [];
    setEditAttachments(paths);
    setEditUploadFiles([]);

    // Map backend item fields to frontend BOM fields
    const mappedItems = (quotation.items || []).map(item => ({
      drawing_no: item.drawing_no || item.item_code || '',
      material_name: item.material_name || '',
      material_type: getCorrectMaterialType(item.drawing_no || item.item_code, item.material_type),
      design_qty: item.design_qty || item.quantity || 0,
      planned_qty: item.planned_qty,
      quantity: item.quantity || 0,
      uom: item.unit || item.uom || 'NOS',
      unit_rate: item.unit_rate || 0,
      laser_cutting: item.laser_cutting || '',
      length: item.length || 0,
      width: item.width || 0,
      thickness: item.thickness || 0,
      diameter: item.diameter || 0,
      outer_diameter: item.outer_diameter || 0,
      density: item.density || 0,
      weight_per_unit: item.weight_per_unit || 0,
      shape_type: item.shape_type || item.shape_name || item.shape || '',
      shape_name: item.shape_name || item.shape_type || item.shape || ''
    }));

    const activeHost = hostCompanies.find(c => c.status === 'ACTIVE') || hostCompanies[0];
    const defaultHostId = quotation.host_company_id || (activeHost ? activeHost.id : '');

    setEditFormData({
      vendorId: quotation.vendor_id,
      status: quotation.status || 'SENT',
      validUntil: quotation.valid_until ? new Date(quotation.valid_until).toISOString().split('T')[0] : '',
      hostCompanyId: String(defaultHostId),
      gstPercentage: quotation.gst_percentage !== undefined && quotation.gst_percentage !== null ? parseFloat(quotation.gst_percentage) : 18,
      items: mappedItems.length > 0 ? mappedItems : [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, uom: 'NOS', unit_rate: 0 }]
    });
    setShowEditModal(true);
  };

  const handleEditQuotation = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      setLoading(true);

      let finalPaths = [...editAttachments];

      // 1. Upload new attachments if selected inside edit modal
      if (editUploadFiles.length > 0) {
        const fileFormData = new FormData();
        editUploadFiles.forEach(file => {
          fileFormData.append('pdf', file);
        });
        fileFormData.append('existing_attachments', editAttachments.join(','));

        const uploadRes = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}/upload-response`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: fileFormData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to upload new attachments');
        }

        const uploadResult = await uploadRes.json();
        finalPaths = uploadResult.paths || [];
      }

      // 2. Perform the PUT request to update quotation details and final attachments paths list
      const response = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: parseInt(editFormData.vendorId),
          validUntil: editFormData.validUntil || null,
          hostCompanyId: editFormData.hostCompanyId ? parseInt(editFormData.hostCompanyId) : null,
          gst_percentage: editFormData.gstPercentage !== undefined ? editFormData.gstPercentage : 18,
          items: editFormData.items,
          received_pdf_path: finalPaths.join(','),
          status: editFormData.status || selectedQuotation.status
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to update quotation');
      }

      successToast('Quotation updated successfully');
      setShowEditModal(false);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      errorToast(error.message || 'Failed to update quotation');
    } finally {
      setLoading(false);
    }
  };

  const openUploadAttachmentsModal = (quotation) => {
    setSelectedQuotation(quotation);
    const paths = quotation.received_pdf_path
      ? quotation.received_pdf_path.split(',').map(p => p.trim()).filter(Boolean)
      : [];
    setExistingAttachments(paths);
    setUploadModalFiles([]);
    setShowUploadAttachmentsModal(true);
  };

  const handleUploadAttachmentsSave = async (e) => {
    e.preventDefault();
    if (!selectedQuotation) return;

    try {
      setUploadingAttachments(true);
      const token = localStorage.getItem('authToken');

      let finalPaths = [...existingAttachments];

      // 1. Upload new files if any, and merge them with remaining existing attachments
      if (uploadModalFiles.length > 0) {
        const fileFormData = new FormData();
        uploadModalFiles.forEach(file => {
          fileFormData.append('pdf', file);
        });
        fileFormData.append('existing_attachments', existingAttachments.join(','));

        const uploadRes = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}/upload-response`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: fileFormData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to upload new files');
        }
      } else {
        // 2. If no new files, perform a single PUT request to update the remaining attachments
        const response = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId: parseInt(selectedQuotation.vendor_id),
            validUntil: selectedQuotation.valid_until,
            hostCompanyId: selectedQuotation.host_company_id ? parseInt(selectedQuotation.host_company_id) : null,
            items: (selectedQuotation.items || []).map(item => ({
              drawing_no: item.drawing_no || item.item_code || '',
              material_name: item.material_name || '',
              material_type: getCorrectMaterialType(item.drawing_no || item.item_code, item.material_type),
              design_qty: item.design_qty || item.quantity || 0,
              quantity: item.quantity || 0,
              uom: item.unit || item.uom || 'NOS',
              unit_rate: item.unit_rate || 0,
              length: item.length || 0,
              width: item.width || 0,
              thickness: item.thickness || 0,
              diameter: item.diameter || 0,
              outer_diameter: item.outer_diameter || 0,
              density: item.density || 0,
              weight_per_unit: item.weight_per_unit || 0,
              shape_type: item.shape_type || item.shape_name || item.shape || '',
              shape_name: item.shape_name || item.shape_type || item.shape || ''
            })),
            received_pdf_path: finalPaths.join(','),
            status: selectedQuotation.status
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to update quotation attachments');
        }
      }

      successToast('Attachments updated successfully');
      setShowUploadAttachmentsModal(false);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      console.error(error);
      errorToast(error.message || 'Failed to save attachments');
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleRemoveExistingAttachment = (indexToRemove) => {
    setExistingAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveNewUploadFile = (indexToRemove) => {
    setUploadModalFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRemoveRecordFile = (indexToRemove) => {
    setRecordFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const openRFQSendModal = (rfq) => {
    // 1. Pre-fill formData with RFQ data
    const mrId = rfq.mr_id;
    const initialMap = {};
    const mrItems = (rfq.items || []).map(item => {
      const assignedIds = (item.assigned_vendors || []).map(v => String(v.vendor_id));
      if (assignedIds.length === 0 && item.vendor_id != null) {
        assignedIds.push(String(item.vendor_id));
      }
      initialMap[item.id] = assignedIds;
      return {
        id: item.id,
        vendor_id: item.vendor_id,
        assigned_vendors: item.assigned_vendors || [],
        drawing_no: item.drawing_no || item.item_code || '—',
        material_name: item.material_name || item.name || item.description || '',
        material_type: getCorrectMaterialType(item.drawing_no || item.item_code, item.material_type),
        quantity: parseFloat(item.quantity) || 0,
        design_qty: parseFloat(item.quantity) || 0,
        planned_qty: parseFloat(item.planned_qty) || 0,
        uom: item.uom || 'NOS',
        unit_rate: 0,
        laser_cutting: item.laser_cutting || '',
        length: item.length || 0,
        width: item.width || 0,
        thickness: item.thickness || 0,
        diameter: item.diameter || 0,
        outer_diameter: item.outer_diameter || 0,
        density: item.density || 0,
        weight_per_unit: item.weight_per_unit || 0,
        shape_type: item.shape_type || item.shape_name || item.shape || '',
        shape_name: item.shape_name || item.shape_type || item.shape || ''
      };
    });

    setItemVendorMap(initialMap);

    setFormData({
      vendorId: '',
      vendorIds: [],
      salesOrderId: `MR-${mrId}`,
      rfq_id: rfq.id,
      validUntil: rfq.valid_until ? rfq.valid_until.split('T')[0] : '',
      notes: rfq.notes || `RFQ Ref: ${rfq.rfq_number}`,
      items: mrItems.length > 0 ? mrItems : [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, design_qty: 0, planned_qty: 0, uom: 'NOS', unit_rate: 0 }]
    });

    // 2. Open create modal
    navigate(`${deptPrefix}/quotations/request`, { state: { fromRFQ: true } });
  };

  const handleAssignSendSave = async (quotationStatus = 'SENT') => {
    if (!formData.rfq_id) return;
    setLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const rfqItems = formData.items || [];

      // Determine which items are newly assigned (have vendors now but didn't before)
      const newlyAssigned = rfqItems.filter(item => {
        const selectedVendorIds = itemVendorMap[item.id] || [];
        const alreadyAssignedIds = (item.assigned_vendors || []).map(v => String(v.vendor_id));
        if (alreadyAssignedIds.length === 0 && item.vendor_id != null) {
          alreadyAssignedIds.push(String(item.vendor_id));
        }

        const newVendors = selectedVendorIds.filter(vId => !alreadyAssignedIds.includes(String(vId)));
        item.newly_assigned_vendor_ids = newVendors;
        return newVendors.length > 0;
      });

      // Group newly assigned items by vendor to create quotations
      const vendorItemsMap = {};
      newlyAssigned.forEach(item => {
        (item.newly_assigned_vendor_ids || []).forEach(vId => {
          if (!vendorItemsMap[vId]) vendorItemsMap[vId] = [];
          vendorItemsMap[vId].push(item);
        });
      });

      const rfqGroupId = `GRP-${Date.now()}`;

      // Create quotations for each vendor's assigned items
      for (const [vId, items] of Object.entries(vendorItemsMap)) {
        const quotationItems = items.map(item => ({
          drawing_no: item.drawing_no || item.item_code || '—',
          item_code: item.item_code || item.drawing_no,
          material_name: item.material_name || item.description || '',
          material_type: item.material_type || 'RAW_MATERIAL',
          quantity: parseFloat(item.quantity) || 0,
          design_qty: parseFloat(item.quantity) || 0,
          planned_qty: parseFloat(item.planned_qty) || 0,
          uom: item.uom || 'NOS',
          unit_rate: 0,
          laser_cutting: item.laser_cutting || null,
          length: item.length || 0,
          width: item.width || 0,
          thickness: item.thickness || 0,
          diameter: item.diameter || 0,
          outer_diameter: item.outer_diameter || 0,
          density: item.density || 0,
          weight_per_unit: item.weight_per_unit || 0,
          shape_type: item.shape_type || item.shape_name || item.shape || '',
          shape_name: item.shape_name || item.shape_type || item.shape || ''
        }));

        const payload = {
          vendorId: parseInt(vId),
          mrId: formData.salesOrderId ? parseInt(formData.salesOrderId.replace('MR-', '')) : null,
          salesOrderId: null,
          rfq_id: formData.rfq_id,
          rfq_group_id: rfqGroupId,
          validUntil: formData.validUntil || null,
          notes: formData.notes || `RFQ Ref`,
          hostCompanyId: formData.hostCompanyId || null,
          status: quotationStatus,
          items: quotationItems
        };

        const res = await fetch(`${API_BASE}/quotations`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to create quotation for vendor ID ${vId}`);
        }
      }

      // Persist per-item vendor assignments in the RFQ
      const assignRes = await fetch(`${API_BASE}/rfqs/${formData.rfq_id}/assign-vendors`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemVendorMap, targetStatus: quotationStatus })
      });

      if (!assignRes.ok) throw new Error('Failed to save vendor assignments');
      const assignData = await assignRes.json();
      const { assigned_items, total_items } = assignData.data || {};

      const assignedCount = newlyAssigned.length + rfqItems.filter(i => i.vendor_id != null).length;
      if (assignedCount >= rfqItems.length) {
        successToast(`All ${total_items} items assigned! Quotations created successfully.`);
      } else {
        successToast(`${assigned_items} of ${total_items} items assigned. Remaining items still pending.`);
      }

      setShowCreateModal(false);
      setFormData({
        vendorId: '',
        vendorIds: [],
        salesOrderId: '',
        rfq_id: null,
        validUntil: '',
        notes: '',
        items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
      });
      setItemVendorMap({});
      navigate(`${deptPrefix}/quotations`);
      fetchQuotations();
      fetchRawRfqs();
      fetchStats();
    } catch (error) {
      console.error('Assign & Send error:', error);
      errorToast(error.message || 'Failed to save assignments');
    } finally {
      setLoading(false);
    }
  };

  const displayQuotations = useMemo(() => {
    let combined = [...quotations];

    // In 'sent' tab, also show RFQs that don't have linked quotations yet, or have partial assignments
    if (activeTab === 'sent') {
      const rfqsNeedingAction = rawRfqs.filter(r => {
        const hasAllQuotes = (r.total_items || 0) > 0 && (r.pending_items || 0) === 0 && (r.quotations || []).length > 0;
        return !hasAllQuotes;
      });
      const rfqPlaceholders = rfqsNeedingAction.map(r => ({
        ...r,
        isRFQOnly: true,
        quote_number: r.rfq_number,
        status: r.status === 'DRAFT' ? 'RFQ_REQUESTED' : r.status,
        vendor_id: null,
        grand_total: 0
      }));
      combined = [...combined, ...rfqPlaceholders];
    }

    // Count how many vendors per RFQ group or source RFQ
    const groupCounts = {};
    const rfqCounts = {};
    quotations.forEach(q => {
      if (q.rfq_group_id) groupCounts[q.rfq_group_id] = (groupCounts[q.rfq_group_id] || 0) + 1;
      if (q.rfq_id) rfqCounts[q.rfq_id] = (rfqCounts[q.rfq_id] || 0) + 1;
    });

    const mapped = combined.filter(q => {
      const isTabMatch = activeTab === 'sent'
        ? ['DRAFT', 'SENT', 'EMAIL_RECEIVED', 'PENDING', 'RFQ_REQUESTED', 'PENDING_ITEMS'].includes(q.status)
        : ['RECEIVED', 'REVIEWED', 'REJECTED'].includes(q.status);
      const matchesStatus = filterStatus === 'All Quotations' || q.status === filterStatus;
      return isTabMatch && matchesStatus;
    }).map(q => {
      // Logic for single vendor label
      let isSingle = false;
      if (q.isRFQOnly) {
        isSingle = false; // Don't show for unassigned ones yet
      } else if (q.rfq_group_id) {
        isSingle = groupCounts[q.rfq_group_id] === 1;
      } else if (q.rfq_id) {
        isSingle = rfqCounts[q.rfq_id] === 1;
      } else {
        isSingle = true; // Isolated quotation record
      }
      return {
        ...q,
        is_single_vendor: isSingle,
        uniqueKey: `${q.isRFQOnly ? 'rfq' : 'quote'}_${q.id}_${q.status}_${q.vendor_id || 'none'}_${q.version || '1'}`
      };
    });

    // Ensure strictly unique items by uniqueKey to prevent DataTable rendering issues
    const seenKeys = new Set();
    return mapped.filter(item => {
      if (seenKeys.has(item.uniqueKey)) return false;
      seenKeys.add(item.uniqueKey);
      return true;
    });
  }, [quotations, rawRfqs, activeTab, filterStatus]);

  const getVendorName = useCallback((vendorId, row = null) => {
    if (row && row.vendor_name) return row.vendor_name;
    if (row && row.company_name) return row.company_name;
    if (!vendorId) return 'Unassigned';
    const found = vendors.find(v => String(v.id) === String(vendorId));
    return found ? found.vendor_name : (vendorId ? `Vendor #${vendorId}` : 'Unassigned');
  }, [vendors]);

  const columns = useMemo(() => {
    const baseCols = [
      {
        key: 'quote_number',
        label: 'Quote No.',
        sortable: true,
        render: (val, q) => (
          <div className=" text-slate-900">
            <div className="text-sm   flex items-center gap-2">
              {val}
              {q.version && (
                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-xs">
                  V{q.version}
                </span>
              )}
              {q.isRFQOnly && q.status === 'PENDING_ITEMS' && (
                <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded text-xs">
                  {q.assigned_items} of {q.total_items} Assigned
                </span>
              )}
              {q.isRFQOnly && q.status !== 'PENDING_ITEMS' && (
                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-xs">
                  No Vendor Assigned
                </span>
              )}
            </div>
            {(q.sales_order_id || q.mr_number) && (
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded ">{q.mr_number || `SO-${q.sales_order_id}`}</span>
              </div>
            )}
          </div>
        )
      },
      {
        key: 'drawing_no',
        label: 'Drawing',
        sortable: true,
        render: (val, q) => (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#111827] leading-[16px]">
              {q.drawing_no || '—'}
            </span>
            {q.finished_good && (
              <span className="text-[10px] text-[#6B7280] leading-[14px] mt-0.5">
                {q.finished_good}
              </span>
            )}
          </div>
        )
      },
      {
        key: 'project_name',
        label: 'Project / Customer',
        sortable: true,
        render: (val, q) => (
          <div className="flex flex-col max-w-[200px]">
            <span className="text-slate-900  truncate" title={val}>{val || '—'}</span>
            {q.company_name && (
              <span className="text-xs text-slate-500 truncate" title={q.company_name}>
                {q.company_name}
              </span>
            )}
          </div>
        )
      },
      {
        key: 'vendor_id',
        label: 'Vendor',
        sortable: true,
        render: (val, q) => (
          <div className="flex flex-col">
            {q.isRFQOnly && q.status === 'PENDING_ITEMS' ? (
              <>
                <span className="text-yellow-600 font-medium text-sm">
                  {q.assigned_items} of {q.total_items} Items Assigned
                </span>
                <span className="text-xs text-amber-500 italic mt-0.5">
                  {q.pending_items} Item{q.pending_items !== 1 ? 's' : ''} Pending Vendor Assignment
                </span>
              </>
            ) : q.isRFQOnly ? (
              <>
                <span className="text-slate-500">Unassigned</span>
                <span className="text-xs text-amber-500 italic mt-1">Select vendor below</span>
              </>
            ) : (
              <>
                <span className="text-slate-900 font-medium">{val ? getVendorName(val, q) : 'Unassigned'}</span>
                {val && q.is_single_vendor && <span className="text-xs text-slate-400 mt-0.5">[Single Vendor]</span>}
                {val && <span className="text-xs text-slate-400 mt-1 flex items-center gap-1 opacity-70">Vendor ID: #{val}</span>}
              </>
            )}
          </div>
        )
      },
      {
        key: activeTab === 'sent' ? 'valid_until' : 'grand_total',
        label: activeTab === 'sent' ? 'Valid Until' : 'Total Amount',
        sortable: true,
        render: (val, _) => activeTab === 'sent' ? (
          <div className="flex flex-col gap-1">
            <span className=" text-slate-700">{formatDate(val)}</span>
            {val && daysValid(val) > 0 && (
              <span className="text-xs  p-1  rounded  bg-emerald-50 text-emerald-600 border border-emerald-100 w-fit">
                {daysValid(val)} days left
              </span>
            )}
            {val && daysValid(val) <= 0 && (
              <span className="text-xs  p-1  rounded  bg-rose-50 text-rose-600 border border-rose-100 w-fit">
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
        render: (val, q) => (
          <div className="flex flex-col gap-1 items-start">
            <span className={`inline-flex px-2.5 py-1 rounded text-xs    border ${rfqStatusColors[val]?.badge}`}>
              {val === 'REJECTED' ? rfqStatusColors[val]?.label : (rfqStatusColors[val]?.label?.toUpperCase() || val)}
            </span>
            {/* Auto Approved label removed */}
          </div>
        )
      },
      {
        key: 'actions',
        label: 'Actions',
        className: 'text-right',
        render: (_, q) => (
          <div className="flex justify-end gap-1.5">
            {!q.isRFQOnly && q.status !== 'REJECTED' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`${deptPrefix}/quotations/view/${q.id}`, { state: { autoPrint: true } });
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all border border-transparent hover:border-indigo-100"
                  title="Print RFQ"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPDF(q.id, q.quote_number);
                  }}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all border border-transparent hover:border-emerald-100"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            {q.isRFQOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); openRFQSendModal(q); }}
                className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded text-xs    hover:bg-amber-100 transition-all"
                title="Assign Vendor & Send"
              >
                <Mail className="w-3.5 h-3.5" />
                Assign & Send
              </button>
            )}

            {activeTab === 'sent' && (
              <>
                {['DRAFT', 'SENT', 'EMAIL_RECEIVED'].includes(q.status) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEmailModal(q); }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded  transition-all border border-transparent hover:border-blue-100"
                    title={q.status === 'SENT' ? 'Resend RFQ' : 'Send RFQ'}
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                )}
                {['SENT', 'EMAIL_RECEIVED'].includes(q.status) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openRecordModal(q); }}
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded  transition-all border border-transparent hover:border-cyan-100"
                    title="Record Vendor Response"
                  >
                    <FilePlus className="w-4 h-4" />
                  </button>
                )}
                {q.status !== 'RECEIVED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded  transition-all border border-transparent hover:border-amber-100"
                    title="Edit RFQ"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            {activeTab === 'received' && (
              <>
                {q.status === 'RECEIVED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApproveQuoteClick(q.id); }}
                    className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded  transition-all border border-emerald-100"
                    title="Approve / Review Quote"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {q.status !== 'REJECTED' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); openUploadAttachmentsModal(q); }}
                      className="flex items-center gap-1 px-1.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded text-[11px] hover:bg-cyan-100 transition-all font-medium whitespace-nowrap"
                      title="Upload Attachments"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded  transition-all border border-transparent hover:border-amber-100"
                      title="Edit Recorded Quote"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (q.isRFQOnly) {
                  handleDeleteRFQ(q.id);
                } else {
                  handleDeleteQuotation(q.id);
                }
              }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded  transition-all border border-transparent hover:border-rose-100"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
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
  }, [activeTab, selectedQuotes, displayQuotations, vendors, quotations, getVendorName, handleApproveQuoteClick, handleDeleteQuotation, openEmailModal]);

  const viewPathMatch = location.pathname.match(/\/quotations\/view\/(\d+)/);
  if (viewPathMatch) {
    return (
      <RFQPrintDetail
        quotationId={viewPathMatch[1]}
        onBack={() => navigate(`${deptPrefix}/quotations`)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-2 rounded  border border-slate-200 ">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded  shadow-lg shadow-blue-200">
            <FileText className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs   text-slate-400   mb-1">
              <span>Buying</span>
              <ChevronRight className="w-3 h-3" />
              <span>Procurement</span>
            </div>
            <h1 className="text-xl  text-slate-900 ">Supplier PO</h1>
            <p className="text-xs text-slate-500 ">Manage and compare supplier quotes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchQuotations(); fetchRawRfqs(); }}
            className="p-2 text-slate-500 hover:bg-white hover:text-blue-600 rounded  transition-all border border-slate-200  active:scale-95 bg-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              if (activeTab === 'sent') {
                navigate('/procurement/quotations/request');
              } else {
                navigate('/procurement/quotations/record');
              }
            }}
            className="flex items-center gap-2  p-2  bg-blue-600 text-white rounded  text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            {activeTab === 'sent' ? 'Request Quote' : 'Record Quote'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <Tabs
          tabs={[
            { label: 'Sent Requests (RFQ)', value: 'sent', icon: Send },
            { label: 'Received Quotes', value: 'received', icon: History }
          ]}
          activeTab={activeTab}
          onTabChange={(value) => {
            if (value === 'sent') navigate(`${deptPrefix}/quotations`);
            else navigate(`${deptPrefix}/quotations/received`);
          }}
          className="border-none px-0"
        />

        {activeTab === 'received' && (
          <div className="flex items-center gap-2">
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
                    const related = displayQuotations.filter(q => String(q.mr_id) === String(mrId) && ['RECEIVED', 'REVIEWED', 'REJECTED'].includes(q.status));
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
            <Button
              variant={selectedQuotes.length >= 2 ? 'primary' : 'default'}
              size="sm"
              onClick={handleCompare}
              disabled={selectedQuotes.length < 2}
              icon={Activity}
            >
              Compare Quotes {selectedQuotes.length > 0 && `(${selectedQuotes.length})`}
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={displayQuotations}
        rowId="uniqueKey"
        loading={loading}
        pageSize={5}
        searchPlaceholder="Search quote number, client, project, drawing..."
        customFilter={(row, searchLower) => {
          const matchesQuoteNo = String(row.quote_number || '').toLowerCase().includes(searchLower);
          const matchesVendor = getVendorName(row.vendor_id).toLowerCase().includes(searchLower);
          const matchesProject = String(row.project_name || '').toLowerCase().includes(searchLower);
          const matchesCompany = String(row.company_name || '').toLowerCase().includes(searchLower);
          const matchesItems = (row.items || []).some(item =>
            String(item.drawing_no || item.item_code || '').toLowerCase().includes(searchLower) ||
            String(item.description || '').toLowerCase().includes(searchLower)
          );
          const matchesDrawing = String(row.drawing_no || '').toLowerCase().includes(searchLower) ||
            String(row.finished_good || '').toLowerCase().includes(searchLower);
          return matchesQuoteNo || matchesVendor || matchesProject || matchesCompany || matchesItems || matchesDrawing;
        }}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="p-2  bg-white border border-slate-200 rounded  text-xs  focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="All Quotations">All Statuses</option>
              {activeTab === 'sent' ? (
                <>
                  <option value="RFQ_REQUESTED">RFQ Requested</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="PENDING">Pending</option>
                  <option value="EMAIL_RECEIVED">Email Received</option>
                </>
              ) : (
                <>
                  <option value="RECEIVED">Received</option>
                  <option value="REVIEWED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </>
              )}
            </select>
            <button className="p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded  transition-all">
              <Download className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[
            { label: 'Total Quotations', value: stats.total_quotations, sub: `Total: ${formatCurrency(stats.total_value)}`, icon: FileText, bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
            { label: 'Pending Quotes', value: stats.pending_quotations, sub: 'Awaiting response', icon: Clock, bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
            { label: 'Approved Quotes', value: stats.approved_quotations, sub: 'Ready for PO', icon: CheckCircle2, bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            { label: 'Received', value: stats.received_quotations || (stats.total_quotations - stats.pending_quotations), sub: 'Vendor responses', icon: Mail, bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
          ].map((stat, idx) => (
            <div key={idx} className={`${stat.bg} border border-slate-200 rounded  p-2  hover: transition-all relative overflow-hidden group`}>
              {stat.bg !== 'bg-white' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded  -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <p className={`text-xs  ${stat.bg === 'bg-white' ? 'text-slate-400' : 'text-blue-100'}  `}>{stat.label}</p>
                  <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded  `}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                </div>
                <p className={`text-xl   ${stat.text} `}>{stat.value || 0}</p>
                <p className={`text-xs ${stat.subText} mt-1 `}>{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded  p-2 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-md text-slate-900 text-xs">
                  {activeTab === 'sent' ? 'Create Quote Request (RFQ)' : 'Record Vendor Quote'}
                </h3>
                {activeTab !== 'sent' && (
                  <p className="text-xs text-slate-500 mt-1">Record details from vendor response</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (formData.rfq_id) {
                    setShowCreateModal(false);
                    setFormData({
                      vendorId: '',
                      vendorIds: [],
                      salesOrderId: '',
                      rfq_id: null,
                      validUntil: '',
                      notes: '',
                      items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
                    });
                    setItemVendorMap({});
                    navigate(`${deptPrefix}/quotations`);
                  } else {
                    navigate(`${deptPrefix}/quotations`);
                  }
                }}
                className="text-slate-500 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={activeTab === 'sent' ? handleCreateQuotation : handleRecordQuote} className="">
              {activeTab === 'sent' ? (
                <>
                  {/* Host Company Profile Details */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-800">Host Billing Entity Details</h3>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between border-b border-slate-100 pb-2">
                        <div className="w-full md:max-w-md space-y-1">
                          <label className="text-[10px] text-slate-400 ml-1">Select Issuing Billing Profile *</label>
                          <select
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700 font-medium"
                            value={selectedHostId}
                            onChange={(e) => {
                              setSelectedHostId(e.target.value);
                            }}
                          >
                            <option value="">Select billing profile...</option>
                            {hostCompanies.map(h => (
                              <option key={h.id} value={h.id}>
                                {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedHostCompany && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs animate-in fade-in duration-300">
                          <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                            {selectedHostCompany.company_logo ? (
                              <img
                                src={getFileUrl(selectedHostCompany.company_logo)}
                                alt="Logo"
                                className="h-12 max-w-full object-contain mb-1 bg-white border border-slate-200 p-1 rounded shadow-sm"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-sm mb-1">
                                {selectedHostCompany.company_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-[10px] font-bold text-slate-800 leading-tight truncate w-full">{selectedHostCompany.company_name}</span>
                            <span className={`text-[8px] mt-1 px-1.5 py-0.5 rounded-full font-semibold border ${selectedHostCompany.status === 'ACTIVE'
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                              }`}>
                              {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                            </span>
                          </div>

                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Office & Contact Details</span>
                            <div className="text-[10px] text-slate-600 space-y-0.5 leading-normal">
                              <p className="font-semibold text-slate-700 whitespace-pre-line">{selectedHostCompany.company_address || '—'}</p>
                              {selectedHostCompany.contact_person && (
                                <p className="text-[9px] text-slate-500">
                                  Contact Person: <span className="font-semibold text-slate-700">{selectedHostCompany.contact_person}</span>
                                </p>
                              )}
                              {selectedHostCompany.email && <p>Email: {selectedHostCompany.email}</p>}
                              {selectedHostCompany.phone && <p>Mobile: {selectedHostCompany.phone}</p>}
                              <div className="pt-1 flex flex-col gap-0.5 border-t border-slate-200 mt-1">
                                <p className="text-[9px] font-mono">GSTIN: <span className="font-bold text-slate-700">{selectedHostCompany.gstin || '—'}</span></p>
                                <p className="text-[9px] font-mono">PAN: <span className="font-bold text-slate-700">{selectedHostCompany.pan || '—'}</span></p>
                              </div>
                            </div>
                          </div>

                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Bank Credentials</span>
                            <div className="text-[10px] text-slate-600 space-y-0.5 leading-normal font-mono">
                              <p className="font-semibold text-slate-700 font-sans">{selectedHostCompany.bank_name || '—'}</p>
                              <p>A/C: {selectedHostCompany.account_number || '—'}</p>
                              {selectedHostCompany.ifsc_code && (
                                <p>IFSC: {selectedHostCompany.ifsc_code.toUpperCase()}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Select Drawing *</label>
                      {formData.rfq_id ? (
                        <input
                          type="text"
                          readOnly
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-medium text-slate-500 cursor-not-allowed"
                          value={(() => {
                            const mrId = formData.salesOrderId?.replace('MR-', '');
                            const mr = materialRequests.find(m => String(m.id) === String(mrId));
                            return mr ? `${mr.drawing_no} - ${mr.finished_good || 'No description'}` : formData.salesOrderId || '';
                          })()}
                        />
                      ) : (
                        <SearchableSelect
                          options={materialRequests.filter(mr => mr.drawing_no).map(mr => ({
                            label: `${mr.drawing_no} - ${mr.finished_good || 'No description'}`,
                            value: `MR-${mr.id}`
                          }))}
                          value={formData.salesOrderId || ''}
                          onChange={handleSalesOrderChange}
                          placeholder="Search & Select Drawing No..."
                          allowCustom={false}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor *</label>
                      {formData.rfq_id ? (
                        <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-medium">
                          Assign vendor per line item below
                        </div>
                      ) : (
                        <MultiSelect
                          options={vendors}
                          value={formData.vendorIds}
                          onChange={(e) => setFormData({ ...formData, vendorIds: e.target.value })}
                          placeholder="Select Vendors..."
                          labelField="vendor_name"
                          valueField="id"
                          subLabelField="email"
                        />
                      )}
                    </div>
                  </div>

                  {(() => {
                    const selectedMRDetails = materialRequests.find(mr => `MR-${mr.id}` === formData.salesOrderId);
                    if (!selectedMRDetails) return null;
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in duration-300">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Project No.</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedMRDetails.project_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Material Request</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedMRDetails.mr_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Drawing No.</span>
                          <span className="text-xs font-bold text-indigo-600">{selectedMRDetails.drawing_no || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Finished Good</span>
                          <span className="text-xs text-slate-600 truncate block" title={selectedMRDetails.finished_good}>{selectedMRDetails.finished_good || '—'}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until</label>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Overall GST (%)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={formData.gstPercentage !== undefined && formData.gstPercentage !== null ? formData.gstPercentage : 18}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                            setFormData({ ...formData, gstPercentage: val });
                          }}
                          className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="18"
                        />
                        <select
                          value={[0, 5, 12, 18, 28].includes(Number(formData.gstPercentage)) ? Number(formData.gstPercentage) : 'custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              setFormData({ ...formData, gstPercentage: parseFloat(e.target.value) });
                            }
                          }}
                          className="p-2 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600 focus:outline-none cursor-pointer shrink-0"
                          title="Quick select standard GST rate"
                        >
                          <option value="custom">Preset</option>
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between my-2 items-center">
                      <div className="flex items-center gap-2">
                        <label className="block text-sm font-semibold text-slate-700">Line Items</label>
                        {formData.rfq_id && (() => {
                          const items = formData.items || [];
                          const already = items.filter(i => i.vendor_id != null).length;
                          const newSel = items.filter(i => i.vendor_id == null && itemVendorMap[i.id]).length;
                          const totalAssigned = already + newSel;
                          return (
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${totalAssigned === items.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {totalAssigned} of {items.length} Items Assigned
                            </span>
                          );
                        })()}
                      </div>
                      {/* {!formData.rfq_id && (
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="p-2  bg-blue-600 text-white text-xs rounded  hover:bg-blue-700"
                        >
                          + Add Item
                        </button>
                      )} */}
                    </div>

                    {formData.items.length === 0 ? (
                      <p className="text-xs text-slate-500 p-2 text-center border border-dashed border-slate-200 rounded">
                        No items added yet. Click "Add Item" to include line items in this quotation.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-xs text-slate-500">
                          <div className="col-span-2">Item ID</div>
                          <div className="col-span-2">Material Name & Dimensions</div>
                          <div className="col-span-2">Vendor</div>
                          <div className="col-span-1">Type</div>
                          <div className="col-span-2">Laser Cutting</div>
                          <div className="col-span-1 text-center">Design Qty</div>
                          <div className="col-span-2 text-center">Required</div>
                        </div>
                        {formData.items.map((item, idx) => {
                          const alreadyAssignedIds = (item.assigned_vendors || []).map(v => String(v.vendor_id));
                          if (alreadyAssignedIds.length === 0 && item.vendor_id != null) {
                            alreadyAssignedIds.push(String(item.vendor_id));
                          }
                          const isAlreadyAssigned = formData.rfq_id && alreadyAssignedIds.length > 0;
                          
                          const selectedVendorIds = itemVendorMap[item.id] || [];
                          const newlySelectedIds = selectedVendorIds.filter(id => !alreadyAssignedIds.includes(String(id)));
                          const hasNewSelection = !isAlreadyAssigned && newlySelectedIds.length > 0;

                          return (
                            <div key={idx} className={`grid grid-cols-12 gap-2 items-start py-2 border-b border-slate-50 last:border-0 ${isAlreadyAssigned ? 'bg-emerald-50/10' : hasNewSelection ? 'bg-amber-50/10' : ''}`}>
                              <div className="col-span-2 relative">
                                <input
                                  type="text"
                                  placeholder="Drawing No"
                                  value={item.drawing_no}
                                  readOnly={!!formData.rfq_id}
                                  onChange={(e) => handleItemChange(idx, 'drawing_no', e.target.value)}
                                  className={`w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${formData.rfq_id ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <input
                                  type="text"
                                  placeholder="Material Name"
                                  value={item.material_name}
                                  readOnly={!!formData.rfq_id}
                                  onChange={(e) => handleItemChange(idx, 'material_name', e.target.value)}
                                  className={`w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${formData.rfq_id ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                                />
                                {formatDimensions(item) && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-1 px-1 font-mono text-[10px] text-slate-500">
                                    {formatDimensions(item)}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-2 space-y-1.5">
                                {formData.rfq_id ? (
                                  <MultiSelect
                                    options={vendors}
                                    value={selectedVendorIds}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItemVendorMap(prev => ({ ...prev, [item.id]: val }));
                                      const newItems = [...formData.items];
                                      newItems[idx].vendorIds = val;
                                      setFormData(prev => ({ ...prev, items: newItems }));
                                    }}
                                    placeholder="Select Vendors..."
                                    labelField="vendor_name"
                                    valueField="id"
                                    compactDisplay={true}
                                    disabledValues={alreadyAssignedIds}
                                  />
                                ) : (
                                  <MultiSelect
                                    options={getAvailableVendors()}
                                    value={item.vendorIds || []}
                                    onChange={(e) => handleItemChange(idx, 'vendorIds', e.target.value)}
                                    placeholder="Select Vendors..."
                                    labelField="vendor_name"
                                    valueField="id"
                                    compactDisplay={true}
                                  />
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder="Type"
                                value={item.material_type}
                                readOnly={!!formData.rfq_id}
                                onChange={(e) => handleItemChange(idx, 'material_type', e.target.value)}
                                className={`col-span-1 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${formData.rfq_id ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                              />
                              <div className="col-span-2">
                                <select
                                  value={item.laser_cutting || ''}
                                  onChange={(e) => handleItemChange(idx, 'laser_cutting', e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer bg-white"
                                >
                                  <option value="">Select</option>
                                  <option value="With Material">With Material</option>
                                  <option value="Without Material">Without Material</option>
                                </select>
                              </div>
                              <div className="col-span-1 flex flex-col items-center">
                                <div className="text-xs text-slate-400 mb-0.5">
                                  {item.planned_qty !== null && item.planned_qty !== undefined
                                    ? (['NOS', 'PCS', 'SETS', 'NO', 'PC'].includes((item.uom || '').toUpperCase())
                                        ? Number(item.planned_qty).toFixed(0)
                                        : Number(item.planned_qty).toFixed(3))
                                    : '-'}
                                  {item.planned_qty !== null && item.planned_qty !== undefined && ' Nos'}
                                </div>
                                <div className="text-xs text-slate-600">
                                  Design Qty
                                </div>
                              </div>
                              <div className="col-span-2 flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Required"
                                  value={item.design_qty === 0 ? 0 : (item.design_qty || '')}
                                  readOnly={!!formData.rfq_id}
                                  onChange={(e) => handleItemChange(idx, 'design_qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                                  className={`w-full p-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${formData.rfq_id ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                                />
                                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs  text-slate-500 flex items-center justify-center min-w-[40px]">
                                  {item.uom || 'Kg'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs  text-slate-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any notes"
                      className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Select Drawing *</label>
                      <SearchableSelect
                        options={materialRequests.filter(mr => mr.drawing_no).map(mr => ({
                          label: `${mr.drawing_no} - ${mr.finished_good || 'No description'}`,
                          value: `MR-${mr.id}`
                        }))}
                        value={recordData.projectId || ''}
                        onChange={(e) => handleRecordProjectChange(e.target.value)}
                        placeholder="Search & Select Drawing No..."
                        allowCustom={false}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor *</label>
                      <select
                        value={recordData.vendorId || ''}
                        onChange={(e) => handleRecordVendorChange(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                  {(() => {
                    const selectedMRDetails = materialRequests.find(mr => `MR-${mr.id}` === recordData.projectId);
                    if (!selectedMRDetails) return null;
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in duration-300">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Project No.</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedMRDetails.project_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Material Request</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedMRDetails.mr_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Drawing No.</span>
                          <span className="text-xs font-bold text-indigo-600">{selectedMRDetails.drawing_no || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Finished Good</span>
                          <span className="text-xs text-slate-600 truncate block" title={selectedMRDetails.finished_good}>{selectedMRDetails.finished_good || '—'}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <label className="block text-xs text-slate-500 mb-1 font-semibold">Subtotal</label>
                        <div className="text-sm font-semibold text-slate-700">{recordData.amount > 0 ? formatCurrency(recordData.amount) : '—'}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <label className="block text-xs text-slate-500 mb-1 font-semibold">Overall GST (%)</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={recordData.gstPercentage !== undefined && recordData.gstPercentage !== null ? recordData.gstPercentage : 18}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                              setRecordData({ ...recordData, gstPercentage: val });
                            }}
                            className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="18"
                          />
                          <select
                            value={[0, 5, 12, 18, 28].includes(Number(recordData.gstPercentage)) ? Number(recordData.gstPercentage) : 'custom'}
                            onChange={(e) => {
                              if (e.target.value !== 'custom') {
                                setRecordData({ ...recordData, gstPercentage: parseFloat(e.target.value) });
                              }
                            }}
                            className="p-1 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600 focus:outline-none cursor-pointer shrink-0"
                            title="Quick select standard GST rate"
                          >
                            <option value="custom">Preset</option>
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <label className="block text-xs text-slate-500 mb-1 font-semibold">GST ({recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18}%)</label>
                        <div className="text-sm font-semibold text-slate-700">
                          {recordData.amount > 0 
                            ? formatCurrency(recordData.amount * ((recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18) / 100)) 
                            : '—'}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded border border-blue-200">
                        <label className="block text-xs text-blue-600 mb-1 font-bold">Grand Total</label>
                        <div className="text-base font-bold text-blue-900">
                          {recordData.amount > 0 
                            ? formatCurrency(recordData.amount * (1 + (recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18) / 100)) 
                            : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-xs   text-slate-700 mb-1">Valid Until</label>
                        <input
                          type="date"
                          value={recordData.validUntil}
                          onChange={(e) => setRecordData({ ...recordData, validUntil: e.target.value })}
                          className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Vendor PDF(s)</label>
                        <input
                          type="file"
                          accept="application/pdf"
                          multiple
                          onChange={handleRecordFileChange}
                          className="w-full p-1 border border-slate-200 rounded text-xs  focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {recordFiles.length > 0 && (
                          <div className="mt-2 max-h-[120px] overflow-y-auto space-y-1 p-1.5 border border-slate-100 rounded bg-slate-50">
                            {recordFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded text-[11px] font-mono">
                                <span className="truncate max-w-[180px]" title={file.name}>{file.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] text-slate-400 font-sans">({(file.size / 1024).toFixed(1)} KB)</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRecordFile(idx)}
                                    className="text-red-500 hover:text-red-700 transition-colors p-0.5"
                                    title="Remove attachment"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center my-2">
                      <div className="flex items-center gap-2">
                        <label className="block text-sm  text-slate-700">Line Items</label>
                        {recordData.received_pdf_path && (
                          <button
                            type="button"
                            onClick={handleParseReceivedPDF}
                            className="flex items-center gap-1.5 p-2  bg-emerald-50 text-emerald-700text-xs   rounded  border border-emerald-200 hover:bg-emerald-100 transition-all"
                            title="Extract rates and quantities from the PDF received via email"
                          >
                            <FileText className="w-3 h-3" />
                            Auto-fill from Email PDF
                          </button>
                        )}
                      </div>
                      {/* <button
                        type="button"
                        onClick={handleRecordAddEmptyItem}
                        className="p-2  bg-blue-600 text-white text-xs rounded  hover:bg-blue-700"
                      >
                        + Add Item
                      </button> */}
                    </div>

                    <div className="border rounded  overflow-visible">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="p-2  text-slate-600" style={{ width: '150px' }}>ITEM ID</th>
                            <th className="p-2  text-slate-600">MATERIAL NAME</th>
                            <th className="p-2  text-slate-600" style={{ width: '100px' }}>TYPE</th>
                            <th className="p-2  text-slate-600" style={{ width: '140px' }}>LASER CUTTING</th>
                            <th className="p-2 text-center  text-slate-600" style={{ width: '80px' }}>Design Qty</th>
                            <th className="p-2 text-center  text-slate-600" style={{ width: '100px' }}>Required</th>
                            <th className="p-2 text-center  text-slate-600" style={{ width: '120px' }}>UNIT RATE (₹/Nos)</th>
                            <th className="p-2 text-right  text-slate-600" style={{ width: '100px' }}>AMOUNT</th>
                            <th className="p-2 text-center" style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recordData.items.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="px-3 py-8 text-center text-slate-400">
                                Select a project and vendor to load items, or add manually.
                              </td>
                            </tr>
                          ) : (
                            recordData.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={item.drawing_no || item.item_code || ''}
                                      onChange={(e) => handleRecordItemChange(idx, 'drawing_no', e.target.value)}
                                      className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                      placeholder="Drawing..."
                                    />
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="min-w-[200px]">
                                    <SearchableSelect
                                      options={stockItems}
                                      value={item.item_code || item.material_name || ''}
                                      onChange={(e) => {
                                        const selected = stockItems.find(i => i.item_code === e.target.value);
                                        handleRecordItemChange(idx, 'item_code', e.target.value);
                                        handleRecordItemChange(idx, 'material_name', selected?.material_name || e.target.value);
                                        handleRecordItemChange(idx, 'material_type', selected?.material_type || item.material_type);
                                        if (selected?.unit) {
                                          handleRecordItemChange(idx, 'uom', selected.unit);
                                        }
                                        if (selected?.length) handleRecordItemChange(idx, 'length', selected.length);
                                        if (selected?.width) handleRecordItemChange(idx, 'width', selected.width);
                                        if (selected?.thickness) handleRecordItemChange(idx, 'thickness', selected.thickness);
                                        if (selected?.diameter) handleRecordItemChange(idx, 'diameter', selected.diameter);
                                        if (selected?.outer_diameter) handleRecordItemChange(idx, 'outer_diameter', selected.outer_diameter);
                                        if (selected?.density) handleRecordItemChange(idx, 'density', selected.density);
                                        if (selected?.weight_per_unit) handleRecordItemChange(idx, 'weight_per_unit', selected.weight_per_unit);
                                        if (selected?.shape_type || selected?.shape_name) {
                                          handleRecordItemChange(idx, 'shape_type', selected.shape_type || selected.shape_name);
                                          handleRecordItemChange(idx, 'shape_name', selected.shape_name || selected.shape_type);
                                        }
                                      }}
                                      placeholder="Select Item"
                                      labelField="material_name"
                                      valueField="item_code"
                                      subLabelField="item_code"
                                      allowCustom={true}
                                    />
                                  </div>
                                  {item.item_code && item.item_code !== item.drawing_no && (
                                    <div className="px-2 text-xs text-slate-400   truncate max-w-[150px]">
                                      Code: {item.item_code}
                                    </div>
                                  )}
                                  {formatDimensions(item) && (
                                    <div className="px-2 text-[10px] text-slate-500 mt-0.5 font-mono">
                                      {formatDimensions(item)}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.material_type}
                                    onChange={(e) => handleRecordItemChange(idx, 'material_type', e.target.value)}
                                    className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                    placeholder="Type..."
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={item.laser_cutting || ''}
                                    onChange={(e) => handleRecordItemChange(idx, 'laser_cutting', e.target.value)}
                                    className="w-full px-2 py-1 border border-slate-200 focus:border-blue-500 rounded outline-none text-xs bg-white cursor-pointer"
                                  >
                                    <option value="">Select</option>
                                    <option value="With Material">With Material</option>
                                    <option value="Without Material">Without Material</option>
                                  </select>
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="number"
                                    value={item.planned_qty === null || item.planned_qty === undefined ? '' : item.planned_qty}
                                    onChange={(e) => handleRecordItemChange(idx, 'planned_qty', e.target.value === '' ? null : parseFloat(e.target.value))}
                                    className="w-16 p-1 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                                    placeholder="0"
                                  />
                                  <div className="text-[9px] text-slate-400 mt-1">
                                    Nos
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="number"
                                      value={item.design_qty === 0 ? 0 : (item.design_qty || item.quantity || '')}
                                      onChange={(e) => handleRecordItemChange(idx, 'design_qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                                      className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all text-center  text-indigo-600"
                                      placeholder="0.000"
                                    />
                                    <div className="text-[9px] text-slate-400 ">
                                      {item.uom || 'Kg'}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    value={item.unit_rate || ''}
                                    onChange={(e) => handleRecordItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-center outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2 text-right text-slate-700 font-medium">
                                  {(((item.planned_qty !== null && item.planned_qty !== undefined && item.planned_qty !== '') ? (parseFloat(item.planned_qty) || 0) : (parseFloat(item.design_qty || item.quantity) || 0)) * (parseFloat(item.unit_rate) || 0)) > 0
                                    ? formatCurrency(((item.planned_qty !== null && item.planned_qty !== undefined && item.planned_qty !== '') ? (parseFloat(item.planned_qty) || 0) : (parseFloat(item.design_qty || item.quantity) || 0)) * (parseFloat(item.unit_rate) || 0))
                                    : '—'}
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRecordRemoveItem(idx)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {recordData.items.length > 0 && (
                      <div className="mt-4 p-2 bg-blue-50 rounded flex flex-col gap-2 border border-blue-100">
                        <div className="flex justify-between items-center text-xs text-blue-600">
                          <span>Subtotal</span>
                          <span className="font-semibold">{recordData.amount > 0 ? formatCurrency(recordData.amount) : '—'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-emerald-600 border-t border-blue-100 pt-2">
                          <span>GST ({recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18}%)</span>
                          <span className="font-semibold">
                            {recordData.amount > 0 
                              ? `+ ${formatCurrency(recordData.amount * ((recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18) / 100))}` 
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-t-2 border-blue-200 pt-2">
                          <span className="text-sm font-bold text-blue-800">Grand Total</span>
                          <span className="text-xl font-bold text-blue-900">
                            {recordData.amount > 0 
                              ? formatCurrency(recordData.amount * (1 + (recordData.gstPercentage !== undefined ? recordData.gstPercentage : 18) / 100)) 
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs  text-slate-700 my-2">Notes (Optional)</label>
                    <textarea
                      value={recordData.notes}
                      onChange={(e) => setRecordData({ ...recordData, notes: e.target.value })}
                      placeholder="Add any notes from vendor response"
                      className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    if (formData.rfq_id) {
                      setShowCreateModal(false);
                      setFormData({
                        vendorId: '',
                        vendorIds: [],
                        salesOrderId: '',
                        rfq_id: null,
                        validUntil: '',
                        notes: '',
                        items: [{ drawing_no: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
                      });
                      setItemVendorMap({});
                      navigate(`${deptPrefix}/quotations`);
                    } else {
                      navigate(`${deptPrefix}/quotations`);
                    }
                  }}
                  className="p-2  border border-slate-200 rounded text-xs  hover:bg-slate-50"
                >
                  Cancel
                </button>
                {activeTab === 'sent' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      if (formData.rfq_id) {
                        handleAssignSendSave('DRAFT');
                      } else {
                        handleCreateQuotation(e, 'DRAFT');
                      }
                    }}
                    className="p-2 border border-blue-600 text-blue-600 rounded text-xs hover:bg-blue-50"
                    disabled={loading}
                  >
                    Save as Draft
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    if (activeTab === 'sent') {
                      if (formData.rfq_id) {
                        handleAssignSendSave('SENT');
                      } else {
                        handleCreateQuotation(e, 'SENT');
                      }
                    } else {
                      handleRecordQuote(e);
                    }
                  }}
                  className="p-2  bg-green-600 text-white rounded text-xs  hover:bg-green-700"
                  disabled={loading}
                >
                  {activeTab === 'sent' ? 'Create & Send RFQ' : 'Record Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmailModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded  p-2 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Send Quotation via Email</h3>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  fetchQuotations();
                  fetchStats();
                }}
                className="text-slate-500 text-xl "
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="">
              <div>
                <label className="block text-xs  text-slate-700 mb-1">To</label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs  text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs  text-slate-700 mb-1">Message</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="5"
                />
              </div>

              <div className="flex items-center gap-2 ">
                <input
                  type="checkbox"
                  id="attachPDF"
                  checked={emailData.attachPDF}
                  onChange={(e) => setEmailData({ ...emailData, attachPDF: e.target.checked })}
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
                  className="p-2  border border-slate-200 rounded text-xs  hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2  bg-blue-600 text-white rounded text-xs  hover:bg-blue-700"
                >
                  Send Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded  p-2 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Edit Quotation</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-xl ">✕</button>
            </div>

            <form onSubmit={handleEditQuotation} className="">
              {/* Host Company Profile Details */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-800">Host Billing Entity Details</h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between border-b border-slate-100 pb-2">
                    <div className="w-full md:max-w-md space-y-1">
                      <label className="text-[10px] text-slate-400 ml-1">Select Issuing Billing Profile *</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700 font-medium"
                        value={editFormData.hostCompanyId || ''}
                        onChange={(e) => {
                          setEditFormData({ ...editFormData, hostCompanyId: e.target.value });
                        }}
                      >
                        <option value="">Select billing profile...</option>
                        {hostCompanies.map(h => (
                          <option key={h.id} value={h.id}>
                            {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const selectedEditHostCompany = hostCompanies.find(h => String(h.id) === String(editFormData.hostCompanyId));
                    if (!selectedEditHostCompany) return null;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs animate-in fade-in duration-300">
                        <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                          {selectedEditHostCompany.company_logo ? (
                            <img
                              src={getFileUrl(selectedEditHostCompany.company_logo)}
                              alt="Logo"
                              className="h-12 max-w-full object-contain mb-1 bg-white border border-slate-200 p-1 rounded shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-sm mb-1">
                              {selectedEditHostCompany.company_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-slate-800 leading-tight truncate w-full">{selectedEditHostCompany.company_name}</span>
                          <span className={`text-[8px] mt-1 px-1.5 py-0.5 rounded-full font-semibold border ${selectedEditHostCompany.status === 'ACTIVE'
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}>
                            {selectedEditHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                          </span>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                          <span className="text-[9px] text-slate-400 block font-semibold uppercase">Office & Contact Details</span>
                          <div className="text-[10px] text-slate-600 space-y-0.5 leading-normal">
                            <p className="font-semibold text-slate-700 whitespace-pre-line">{selectedEditHostCompany.company_address || '—'}</p>
                            {selectedEditHostCompany.contact_person && (
                              <p className="text-[9px] text-slate-500">
                                Contact Person: <span className="font-semibold text-slate-700">{selectedEditHostCompany.contact_person}</span>
                              </p>
                            )}
                            {selectedEditHostCompany.email && <p>Email: {selectedEditHostCompany.email}</p>}
                            {selectedEditHostCompany.phone && <p>Mobile: {selectedEditHostCompany.phone}</p>}
                            <div className="pt-1 flex flex-col gap-0.5 border-t border-slate-200 mt-1">
                              <p className="text-[9px] font-mono">GSTIN: <span className="font-bold text-slate-700">{selectedEditHostCompany.gstin || '—'}</span></p>
                              <p className="text-[9px] font-mono">PAN: <span className="font-bold text-slate-700">{selectedEditHostCompany.pan || '—'}</span></p>
                            </div>
                          </div>
                        </div>

                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                          <span className="text-[9px] text-slate-400 block font-semibold uppercase">Bank Credentials</span>
                          <div className="text-[10px] text-slate-600 space-y-0.5 leading-normal font-mono">
                            <p className="font-semibold text-slate-700 font-sans">{selectedEditHostCompany.bank_name || '—'}</p>
                            <p>A/C: {selectedEditHostCompany.account_number || '—'}</p>
                            {selectedEditHostCompany.ifsc_code && (
                              <p>IFSC: {selectedEditHostCompany.ifsc_code.toUpperCase()}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor *</label>
                  <select
                    value={editFormData.vendorId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, vendorId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.vendor_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={editFormData.validUntil || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, validUntil: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Status *</label>
                  <select
                    value={editFormData.status || 'SENT'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="SENT">SENT (Issued RFQ)</option>
                    <option value="RECEIVED">RECEIVED (Quoted)</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Overall GST (%)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={editFormData.gstPercentage !== undefined && editFormData.gstPercentage !== null ? editFormData.gstPercentage : 18}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                        setEditFormData({ ...editFormData, gstPercentage: val });
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="18"
                    />
                    <select
                      value={[0, 5, 12, 18, 28].includes(Number(editFormData.gstPercentage)) ? Number(editFormData.gstPercentage) : 'custom'}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') {
                          setEditFormData({ ...editFormData, gstPercentage: parseFloat(e.target.value) });
                        }
                      }}
                      className="p-2 bg-slate-100 border border-slate-300 rounded text-xs text-slate-600 focus:outline-none cursor-pointer shrink-0"
                      title="Quick select standard GST rate"
                    >
                      <option value="custom">Preset</option>
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center my-2">
                  <label className="block text-sm  text-slate-700">Line Items</label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData({
                        ...editFormData,
                        items: [...editFormData.items, { drawing_no: '', material_name: '', material_type: '', design_qty: 0, quantity: 0, planned_qty: null, uom: 'NOS', unit_rate: 0 }]
                      });
                    }}
                    className="p-2  bg-blue-600 text-white text-xs rounded  hover:bg-blue-700"
                  >
                    + Add Item
                  </button>
                </div>
                {editFormData.items.length === 0 ? (
                  <p className="text-xs text-slate-500 p-2 text-center border border-dashed border-slate-200 rounded">
                    No items added yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-xs   text-slate-500  ">
                      {activeTab === 'sent' ? (
                        <>
                          <div className="col-span-2">Drawing No</div>
                          <div className="col-span-3">Material Name</div>
                          <div className="col-span-1">Type</div>
                          <div className="col-span-2">Laser Cutting</div>
                          <div className="col-span-1 text-center">Design Qty</div>
                          <div className="col-span-2 text-center">Required</div>
                          <div className="col-span-1"></div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-2">Drawing No</div>
                          <div className="col-span-2">Material Name</div>
                          <div className="col-span-1">Type</div>
                          <div className="col-span-2">Laser Cutting</div>
                          <div className="col-span-1 text-center">Design Qty</div>
                          <div className="col-span-1 text-center">Quoted Qty</div>
                          <div className="col-span-1 text-center">UNIT RATE (₹/Nos)</div>
                          <div className="col-span-1 text-right">Amount</div>
                          <div className="col-span-1"></div>
                        </>
                      )}
                    </div>
                    {editFormData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-start py-1">
                        {activeTab === 'sent' ? (
                          <>
                            <input
                              type="text"
                              placeholder="Drawing No"
                              value={item.drawing_no}
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[idx].drawing_no = e.target.value;
                                newItems[idx].material_type = getCorrectMaterialType(e.target.value, newItems[idx].material_type);
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              className="col-span-2 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="col-span-3 flex flex-col">
                              <SearchableSelect
                                options={stockItems}
                                value={item.item_code || ''}
                                onChange={(e) => {
                                  const selected = stockItems.find(i => i.item_code === e.target.value);
                                  const newItems = [...editFormData.items];
                                  newItems[idx].item_code = e.target.value;
                                  newItems[idx].material_name = selected?.material_name || e.target.value;
                                  newItems[idx].material_type = selected?.material_type || newItems[idx].material_type;
                                  if (selected?.unit) {
                                    newItems[idx].uom = selected.unit;
                                  }
                                  if (selected?.length) newItems[idx].length = selected.length;
                                  if (selected?.width) newItems[idx].width = selected.width;
                                  if (selected?.thickness) newItems[idx].thickness = selected.thickness;
                                  if (selected?.diameter) newItems[idx].diameter = selected.diameter;
                                  if (selected?.outer_diameter) newItems[idx].outer_diameter = selected.outer_diameter;
                                  if (selected?.density) newItems[idx].density = selected.density;
                                  if (selected?.weight_per_unit) newItems[idx].weight_per_unit = selected.weight_per_unit;
                                  if (selected?.shape_type || selected?.shape_name) {
                                    newItems[idx].shape_type = selected.shape_type || selected.shape_name;
                                    newItems[idx].shape_name = selected.shape_name || selected.shape_type;
                                  }
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                placeholder="Select Item"
                                labelField="material_name"
                                valueField="item_code"
                                subLabelField="item_code"
                                allowCustom={true}
                              />
                              {formatDimensions(item) && (
                                <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 opacity-70 font-mono text-[10px] text-slate-500">
                                  {formatDimensions(item)}
                                </div>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Type"
                              value={item.material_type}
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[idx].material_type = e.target.value;
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              className="col-span-1 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="col-span-2">
                              <select
                                value={item.laser_cutting || ''}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  newItems[idx].laser_cutting = e.target.value;
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer bg-white"
                              >
                                <option value="">Select</option>
                                <option value="With Material">With Material</option>
                                <option value="Without Material">Without Material</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex flex-col items-center">
                              <input
                                type="number"
                                value={item.planned_qty === null || item.planned_qty === undefined ? '' : item.planned_qty}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  newItems[idx].planned_qty = e.target.value === '' ? null : parseFloat(e.target.value);
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full p-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                                placeholder="0"
                              />
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                Nos
                              </div>
                            </div>
                            <div className="col-span-2 flex flex-col items-center">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={item.design_qty === 0 ? 0 : (item.design_qty || '')}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  const val = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                  newItems[idx].design_qty = val;
                                  newItems[idx].quantity = val;
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full p-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-xs  text-slate-400 mt-0.5 ">{item.uom || 'Kg'}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              placeholder="Drawing No"
                              value={item.drawing_no}
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[idx].drawing_no = e.target.value;
                                newItems[idx].material_type = getCorrectMaterialType(e.target.value, newItems[idx].material_type);
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              className="col-span-2 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="col-span-2 flex flex-col">
                              <SearchableSelect
                                options={stockItems}
                                value={item.item_code || item.material_name || ''}
                                onChange={(e) => {
                                  const selected = stockItems.find(i => i.item_code === e.target.value);
                                  const newItems = [...editFormData.items];
                                  newItems[idx].item_code = e.target.value;
                                  newItems[idx].material_name = selected?.material_name || e.target.value;
                                  newItems[idx].material_type = selected?.material_type || newItems[idx].material_type;
                                  if (selected?.unit) {
                                    newItems[idx].uom = selected.unit;
                                  }
                                  if (selected?.length) newItems[idx].length = selected.length;
                                  if (selected?.width) newItems[idx].width = selected.width;
                                  if (selected?.thickness) newItems[idx].thickness = selected.thickness;
                                  if (selected?.diameter) newItems[idx].diameter = selected.diameter;
                                  if (selected?.outer_diameter) newItems[idx].outer_diameter = selected.outer_diameter;
                                  if (selected?.density) newItems[idx].density = selected.density;
                                  if (selected?.weight_per_unit) newItems[idx].weight_per_unit = selected.weight_per_unit;
                                  if (selected?.shape_type || selected?.shape_name) {
                                    newItems[idx].shape_type = selected.shape_type || selected.shape_name;
                                    newItems[idx].shape_name = selected.shape_name || selected.shape_type;
                                  }
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                placeholder="Select Item"
                                labelField="material_name"
                                valueField="item_code"
                                subLabelField="item_code"
                                allowCustom={true}
                              />
                              {formatDimensions(item) && (
                                <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 opacity-70 font-mono text-[10px] text-slate-500">
                                  {formatDimensions(item)}
                                </div>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Type"
                              value={item.material_type}
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[idx].material_type = e.target.value;
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              className="col-span-1 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="col-span-2">
                              <select
                                value={item.laser_cutting || ''}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  newItems[idx].laser_cutting = e.target.value;
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer bg-white"
                              >
                                <option value="">Select</option>
                                <option value="With Material">With Material</option>
                                <option value="Without Material">Without Material</option>
                              </select>
                            </div>
                            <div className="col-span-1 flex flex-col items-center">
                              <input
                                type="number"
                                value={item.planned_qty === null || item.planned_qty === undefined ? '' : item.planned_qty}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  newItems[idx].planned_qty = e.target.value === '' ? null : parseFloat(e.target.value);
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full p-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                                placeholder="0"
                              />
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                Nos
                              </div>
                            </div>
                            <div className="col-span-1 flex flex-col items-center">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={item.quantity === 0 ? 0 : (item.quantity || item.design_qty || '')}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  const val = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                  newItems[idx].design_qty = val;
                                  newItems[idx].quantity = val;
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full p-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {item.uom || 'Kg'}
                              </div>
                            </div>
                            <input
                              type="number"
                              placeholder="Rate"
                              value={item.unit_rate}
                              onChange={(e) => {
                                const newItems = [...editFormData.items];
                                newItems[idx].unit_rate = parseFloat(e.target.value) || 0;
                                setEditFormData({ ...editFormData, items: newItems });
                              }}
                              className="col-span-1 p-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                            />
                            <div className="col-span-1 text-right text-xs text-slate-700 pt-2 font-medium">
                              {formatCurrency(((item.planned_qty !== null && item.planned_qty !== undefined && item.planned_qty !== '') ? (parseFloat(item.planned_qty) || 0) : (parseFloat(item.design_qty || item.quantity) || 0)) * (parseFloat(item.unit_rate) || 0))}
                            </div>
                          </>
                        )}
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = editFormData.items.filter((_, i) => i !== idx);
                              setEditFormData({ ...editFormData, items: newItems });
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

                {editFormData.items.length > 0 && (() => {
                  const editSubtotal = editFormData.items.reduce((sum, item) => {
                    const qty = (item.planned_qty !== null && item.planned_qty !== undefined && item.planned_qty !== '') 
                      ? (parseFloat(item.planned_qty) || 0) 
                      : (parseFloat(item.design_qty || item.quantity) || 0);
                    const rate = parseFloat(item.unit_rate) || 0;
                    return sum + (qty * rate);
                  }, 0);
                  const editGstRate = editFormData.gstPercentage !== undefined ? editFormData.gstPercentage : 18;
                  const editGstAmount = editSubtotal * (editGstRate / 100);
                  const editGrandTotal = editSubtotal + editGstAmount;

                  return (
                    <div className="mt-4 p-3 bg-blue-50 rounded flex flex-col gap-2 border border-blue-100">
                      <div className="flex justify-between items-center text-xs text-blue-600">
                        <span>Subtotal</span>
                        <span className="font-semibold">{editSubtotal > 0 ? formatCurrency(editSubtotal) : '—'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-emerald-600 border-t border-blue-100 pt-2">
                        <span>GST ({editGstRate}%)</span>
                        <span className="font-semibold">{editSubtotal > 0 ? `+ ${formatCurrency(editGstAmount)}` : '—'}</span>
                      </div>
                      <div className="flex justify-between items-center border-t-2 border-blue-200 pt-2">
                        <span className="text-sm font-bold text-blue-800">Grand Total</span>
                        <span className="text-xl font-bold text-blue-900">{editSubtotal > 0 ? formatCurrency(editGrandTotal) : '—'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Attachments Section inside Edit Modal */}
              {activeTab === 'received' && (
                <div className="space-y-2 border-t border-slate-200 pt-4 mt-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded">
                      <Upload className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-semibold text-slate-800">Quotation Attachments</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Existing Attachments */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">Existing Attachments ({editAttachments.length})</span>
                      {editAttachments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic p-2 border border-dashed border-slate-200 rounded bg-slate-50">No files attached</p>
                      ) : (
                        <div className="max-h-[120px] overflow-y-auto space-y-1 p-1.5 border border-slate-200 rounded bg-slate-50">
                          {editAttachments.map((file, idx) => {
                            const cleanName = file.substring(file.lastIndexOf('/') + 1).substring(file.indexOf('-') + 1);
                            return (
                              <div key={idx} className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded text-[11px]">
                                <a
                                  href={`${API_BASE}/quotations/${selectedQuotation.id}/received-pdf?file=${encodeURIComponent(file)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline truncate max-w-[200px]"
                                  title="Download/View file"
                                >
                                  {cleanName}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 transition-colors p-0.5"
                                  title="Remove attachment"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Upload New Attachments */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 block">Upload New Files</span>
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setEditUploadFiles(prev => [...prev, ...files]);
                        }}
                        className="w-full p-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {editUploadFiles.length > 0 && (
                        <div className="max-h-[100px] overflow-y-auto space-y-1 p-1.5 border border-slate-100 rounded mt-1.5 bg-slate-50">
                          {editUploadFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded text-[10px] font-mono">
                              <span className="truncate max-w-[180px]">{file.name}</span>
                              <div className="flex items-center gap-1.5 font-sans">
                                <span className="text-[9px] text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                                <button
                                  type="button"
                                  onClick={() => setEditUploadFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 transition-colors p-0.5"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-2  border border-slate-200 rounded text-xs  hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2  bg-blue-600 text-white rounded text-xs  hover:bg-blue-700"
                >
                  Update Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showUploadAttachmentsModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded p-4 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-md font-semibold text-slate-800 text-xs">Upload Supplier PO Attachments</h3>
              <button onClick={() => setShowUploadAttachmentsModal(false)} className="text-slate-500 text-xl">✕</button>
            </div>

            <form onSubmit={handleUploadAttachmentsSave} className="space-y-4">
              <div className="text-xs text-slate-500 mb-2">
                Manage and upload multiple attachment files for quotation <strong>{selectedQuotation.quote_number}</strong>.
              </div>

              {/* Existing Attachments */}
              {existingAttachments.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 block">Existing Attachments ({existingAttachments.length})</span>
                  <div className="max-h-[150px] overflow-y-auto space-y-1 border border-slate-100 p-2 rounded bg-slate-50">
                    {existingAttachments.map((file, idx) => {
                      const cleanName = file.substring(file.lastIndexOf('/') + 1).substring(file.indexOf('-') + 1);
                      return (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded text-xs">
                          <a
                            href={`${API_BASE}/quotations/${selectedQuotation.id}/received-pdf?file=${encodeURIComponent(file)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[280px]"
                            title="Download/View file"
                          >
                            {cleanName}
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingAttachment(idx)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="Remove file"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload New Files */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 block">Upload New Files</span>
                <div className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      setUploadModalFiles(prev => [...prev, ...files]);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 block">Drag & drop or click to select files</span>
                    <span className="text-[10px] text-slate-400 block">Multiple PDF files accepted</span>
                  </div>
                </div>

                {uploadModalFiles.length > 0 && (
                  <div className="max-h-[150px] overflow-y-auto space-y-1 border border-slate-100 p-2 rounded mt-2">
                    {uploadModalFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono">
                        <span className="truncate max-w-[280px]">{file.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-sans">({(file.size / 1024).toFixed(1)} KB)</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveNewUploadFile(idx)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadAttachmentsModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs hover:bg-slate-50"
                  disabled={uploadingAttachments}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1.5"
                  disabled={uploadingAttachments}
                >
                  {uploadingAttachments ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Attachments'
                  )}
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
          title="Compare Supplier PO"
          size="6xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-2 border text-left text-xs  text-slate-600 sticky left-0 bg-slate-50 z-10">Item / Drawing No.</th>
                  <th className="p-2 border text-center text-xs  text-slate-600 bg-slate-50">Design Qty</th>
                  <th className="p-2 border text-center text-xs  text-slate-600 bg-slate-50">Required</th>
                  {compareData.map((q, idx) => (
                    <th key={idx} className="p-2 border text-center text-xs  text-slate-800 bg-indigo-50/50" colSpan="2">
                      <div className="flex flex-col gap-1">
                        <span className="text-indigo-600">{getVendorName(q.vendor_id)}</span>
                        <span className="text-xs text-slate-500 font-normal">{q.quote_number}</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50/50text-xs    text-slate-400">
                  <th className="p-2 border sticky left-0 bg-slate-50/50 z-10"></th>
                  <th className="p-2 border"></th>
                  <th className="p-2 border"></th>
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
                      <td className="p-2 border  text-slate-900 sticky left-0 bg-white z-10">
                        <div className="flex flex-col">
                          <span>{itemCode}</span>
                          <span className="text-xs text-slate-400 font-normal">{firstItem?.material_name}</span>
                          {formatDimensions(firstItem) && (
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{formatDimensions(firstItem)}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border text-center text-slate-400">
                        {firstItem?.planned_qty !== null && firstItem?.planned_qty !== undefined
                          ? (['NOS', 'PCS', 'SETS', 'NO', 'PC'].includes((firstItem?.uom || '').toUpperCase())
                              ? Number(firstItem.planned_qty).toFixed(0)
                              : Number(firstItem.planned_qty).toFixed(3))
                          : '-'}
                      </td>
                      <td className="p-2 border text-center text-slate-800 ">
                        {Number(firstItem?.quantity || 0).toFixed(3)}
                      </td>
                      {compareData.map((q, qIdx) => {
                        const item = (q.items || []).find(it => (it.item_code || it.drawing_no) === itemCode);
                        return (
                          <React.Fragment key={qIdx}>
                            <td className="p-2 border text-right text-slate-600">
                              {item ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="radio"
                                    name={`award-${itemCode}`}
                                    checked={selectedAwards[itemCode] === q.id}
                                    onChange={() => setSelectedAwards(prev => ({ ...prev, [itemCode]: q.id }))}
                                    className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                                  />
                                  <span>{formatCurrency(item.unit_rate)}</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td className={`p-2 border text-right   ${item ? 'text-indigo-600 ' : 'text-slate-300'}`}>
                              {item ? formatCurrency(item.amount || (item.unit_rate * (item.quantity || 0))) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 ">
                  <td className="p-2 border text-right sticky left-0 bg-slate-50 z-10" colSpan="3">GRAND TOTAL</td>
                  {compareData.map((q, idx) => (
                    <td key={idx} className="p-2 border text-right text-indigo-700 text-sm" colSpan="2">
                      {formatCurrency(q.total_amount)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-white">
                  <td className="p-2 border text-right sticky left-0 bg-white z-10 font-semibold" colSpan="3">Award Selection Summary</td>
                  <td className="p-2 border text-left" colSpan={compareData.length * 2}>
                    <div className="flex flex-col gap-1.5 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100 max-w-xl">
                      <span className="font-semibold text-emerald-800">Awarded Items Grouping:</span>
                      {Object.entries(selectedAwards).map(([itemCode, qId]) => {
                        const quote = compareData.find(q => q.id === qId);
                        return (
                          <div key={itemCode} className="flex justify-between items-center text-xs text-slate-700 font-medium">
                            <span className="font-semibold">{itemCode}</span>
                            <span className="text-emerald-700 font-bold">→ {getVendorName(quote?.vendor_id)} ({quote?.quote_number})</span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-4 sticky bottom-0 bg-white z-20">
            <button
              type="button"
              onClick={() => setShowCompareModal(false)}
              className="p-2 border border-slate-200 rounded text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <Button
              variant="success"
              onClick={handleBulkApproveCompared}
              disabled={Object.keys(selectedAwards).length === 0}
            >
              Approve Awards & Create Purchase Orders
            </Button>
          </div>
        </Modal>
      )}

      {showApprovalModal && approvalModalQuote && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          title="Approve Supplier PO"
          size="3xl"
        >
          <div className="space-y-6 text-sm">
            {/* Vendor Details Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Vendor Details</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400">Vendor:</span>{' '}
                  <span className="font-semibold">{getVendorName(approvalModalQuote.vendor_id)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Quotation No.:</span>{' '}
                  <span className="font-semibold">{approvalModalQuote.quote_number}</span>
                </div>
                <div>
                  <span className="text-slate-400">Material Request:</span>{' '}
                  <span className="font-semibold">{approvalModalQuote.mr_id || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Project:</span>{' '}
                  <span className="font-semibold">{approvalModalQuote.project_details || '—'}</span>
                </div>
                <div className="col-span-2 mt-1">
                  <span className="text-slate-400">Valid Until:</span>{' '}
                  <span className="font-semibold text-indigo-600">{formatDate(approvalModalQuote.valid_until)}</span>
                </div>
              </div>
            </div>

            {/* Quoted Items Section */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quoted Items</h3>
              <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-600 text-left">
                      <th className="p-2 font-semibold">Item</th>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold text-center">Qty</th>
                      <th className="p-2 font-semibold text-right">Unit Rate</th>
                      <th className="p-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalModalItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="p-2 text-slate-800 font-medium">{item.item_code || item.drawing_no || '—'}</td>
                        <td className="p-2 text-slate-500 truncate max-w-[200px]" title={item.description || item.material_name}>
                          <div>{item.description || item.material_name || '—'}</div>
                          {formatDimensions(item) && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {formatDimensions(item)}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center text-slate-700">{Number(item.quantity || 0).toFixed(3)}</td>
                        <td className="p-2 text-right text-slate-700">{formatCurrency(item.unit_rate)}</td>
                        <td className="p-2 text-right font-medium text-slate-900">
                          {formatCurrency(item.amount || (item.unit_rate * (item.quantity || 0)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end items-center gap-2 mt-3 pr-2 text-xs">
                <span className="text-slate-500 font-semibold uppercase">Grand Total:</span>
                <span className="text-sm font-bold text-indigo-700">
                  {formatCurrency(approvalModalQuote.grand_total || approvalModalQuote.total_amount)}
                </span>
              </div>
            </div>

            {/* Confirmation Alert Box */}
            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Are you sure you want to approve this Supplier PO?</p>
              <p className="text-amber-700/95">This action will enable Purchase Order creation for the approved items.</p>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div>
                <Button
                  variant="danger"
                  onClick={() => handleApprovalAction(approvalModalQuote.id, 'REJECTED')}
                >
                  Reject Quote
                </Button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs hover:bg-slate-50 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <Button
                  variant="success"
                  onClick={() => handleApprovalAction(approvalModalQuote.id, 'REVIEWED')}
                >
                  Approve Quote
                </Button>
              </div>
            </div>
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

