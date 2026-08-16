import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, DataTable, StatusBadge, Modal, FormControl, SearchableSelect } from '../components/ui.jsx';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Package,
  RefreshCw,
  Eye,
  FileEdit,
  Trash2,
  Calendar,
  ChevronRight,
  LayoutGrid,
  List,
  CheckCircle2,
  User,
  Warehouse,
  ClipboardCheck,
  X,
  ArrowLeft,
  Download,
  Printer,
  History,
  AlertCircle,
  Building2,
  Upload,
  Send
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';
import { getFileUrl } from '../utils/url';

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
  const location = useLocation();
  const navigate = useNavigate();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

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
  const [stockBalances, setStockBalances] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hostCompanies, setHostCompanies] = useState([]);
  const [selectedHostCompany, setSelectedHostCompany] = useState(null);
  const [isHostCompanyLocked, setIsHostCompanyLocked] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  // --- View modal inline edit state ---
  const [isViewEditMode, setIsViewEditMode] = useState(false);
  const [viewEditItems, setViewEditItems] = useState([]);
  const [isSavingViewEdit, setIsSavingViewEdit] = useState(false);

  useEffect(() => {
    const path = location.pathname;

    if (path === `${deptPrefix}/po-receipts/add`) {
      if (!showCreateModal) {
        const activeCompany = hostCompanies.find(c => c.status === 'ACTIVE') || hostCompanies[0];
        setFormData({
          poId: '',
          vendorName: '',
          vendorId: '',
          receiptDate: new Date().toISOString().split('T')[0],
          receivedQuantity: 0,
          totalValuation: 0,
          notes: '',
          items: [],
          host_company_id: activeCompany ? String(activeCompany.id) : ''
        });
        setIsHostCompanyLocked(false);
        setAttachments([]);
        setExistingAttachments([]);
        setShowCreateModal(true);
        setShowEditModal(false);
        setShowViewModal(false);
      }
    } else if (path.startsWith(`${deptPrefix}/po-receipts/view/`)) {
      const id = path.split('/').pop();
      if (!showViewModal || selectedReceiptForView?.id?.toString() !== id) {
        handleViewReceiptDetail(id);
        setShowCreateModal(false);
        setShowEditModal(false);
      }
    } else if (path.startsWith(`${deptPrefix}/po-receipts/edit/`)) {
      const id = path.split('/').pop();
      if (!showEditModal || selectedReceipt?.id?.toString() !== id) {
        handleEditReceipt(id);
        setShowCreateModal(false);
        setShowViewModal(false);
      }
    } else if (path === `${deptPrefix}/po-receipts/stocks`) {
      if (activeTab !== 'stocks') {
        setActiveTab('stocks');
        setShowCreateModal(false);
        setShowEditModal(false);
        setShowViewModal(false);
      }
    } else if (path === `${deptPrefix}/po-receipts`) {
      if (showCreateModal) setShowCreateModal(false);
      if (showEditModal) setShowEditModal(false);
      if (showViewModal) {
        setShowViewModal(false);
        setSelectedReceiptForView(null);
      }
      if (activeTab !== 'grn') setActiveTab('grn');
    }
  }, [location.pathname, receipts, deptPrefix, hostCompanies]);

  const handleViewReceiptDetail = async (receiptId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedReceiptForView(data);
        setExistingAttachments(data.pdf_path ? data.pdf_path.split(',').map(f => f.trim()).filter(Boolean) : []);
        setShowViewModal(true);
      }
    } catch (error) {
      errorToast('Failed to load receipt details');
    }
  };

  const [formData, setFormData] = useState({
    poId: '',
    vendorName: '',
    vendorId: '',
    receiptDate: new Date().toISOString().split('T')[0],
    receivedQuantity: 0,
    totalValuation: 0,
    notes: '',
    items: [],
    host_company_id: ''
  });

  const handleAddLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          item_code: '',
          description: '',
          material_name: '',
          drawing_no: '',
          quantity: 0,
          received_qty: 0,
          rate: 0,
          amount: 0,
          warehouse: warehouses[0]?.warehouse_code || 'main',
          unit: 'NOS',
          is_custom: true
        }
      ]
    }));
  };

  // --- View modal inline edit helpers ---
  const handleEnterViewEdit = () => {
    setViewEditItems((selectedReceiptForView?.items || []).map(it => ({ ...it })));
    setIsViewEditMode(true);
  };

  const handleCancelViewEdit = () => {
    setIsViewEditMode(false);
    setViewEditItems([]);
  };

  const handleViewItemChange = (idx, field, value) => {
    setViewEditItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSaveViewEdits = async () => {
    if (!selectedReceiptForView) return;
    setIsSavingViewEdit(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload = new FormData();
      payload.append('items', JSON.stringify(viewEditItems));
      const response = await fetch(`${API_BASE}/po-receipts/${selectedReceiptForView.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: payload
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save');
      }
      // Reload the view data
      const refreshed = await fetch(`${API_BASE}/po-receipts/${selectedReceiptForView.id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const updatedData = await refreshed.json();
      setSelectedReceiptForView(updatedData);
      setIsViewEditMode(false);
      setViewEditItems([]);
      successToast('GRN items updated successfully');
      fetchReceipts();
    } catch (error) {
      errorToast(error.message || 'Failed to save changes');
    } finally {
      setIsSavingViewEdit(false);
    }
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

    if (field === 'received_qty' || field === 'current_receiving_qty' || field === 'current_receiving_weight' || field === 'rate' || field === 'unit_rate') {
      const item = newItems[index];

      // Auto-calculate receiving weight from receiving quantity
      if (field === 'current_receiving_qty' || field === 'received_qty') {
        const ordQty = parseFloat(item.ordered_qty || item.design_qty || 0);
        const ordWeight = parseFloat(item.ordered_weight || item.quantity || 0);
        const weightPerUnit = ordQty > 0 ? (ordWeight / ordQty) : 0;
        const receivingQtyVal = parseFloat(value) || 0;
        const newWeight = parseFloat((receivingQtyVal * weightPerUnit).toFixed(3));
        item.current_receiving_weight = newWeight;
        item.received_weight = newWeight;
      }

      const lcStr = String(item.laser_cutting || '').trim().toUpperCase();
      const isLaser = item.laser_cutting === "With Material" || item.laser_cutting === "Without Material" || 
                      lcStr === "WITH_MATERIAL" || lcStr === "WITHOUT_MATERIAL" ||
                      lcStr.includes("WITH MATERIAL") || lcStr.includes("WITHOUT MATERIAL");

      const isBoughtOut = (item.material_type || item.item_type || '').toUpperCase().trim().includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
      const currQty = parseFloat(item.current_receiving_qty !== undefined && item.current_receiving_qty !== '' ? item.current_receiving_qty : (item.received_qty || 0)) || 0;
      const currWeight = parseFloat(item.current_receiving_weight !== undefined && item.current_receiving_weight !== '' ? item.current_receiving_weight : (item.received_weight || 0)) || 0;
      const effectiveQty = (isLaser || isBoughtOut) ? currQty : currWeight;
      const rate = parseFloat(item.rate !== undefined && item.rate !== '' ? item.rate : (item.unit_rate || 0)) || 0;

      newItems[index].rate = rate;
      newItems[index].unit_rate = rate;
      newItems[index].amount = effectiveQty * rate;
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/items?includeAll=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const filteredData = (Array.isArray(data) ? data : []).filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
        setStockItems(filteredData);
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

  const fetchHostCompanies = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/admin-company-master`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHostCompanies(data);
        const active = data.find(c => c.status === 'ACTIVE') || data[0];
        if (active) {
          setFormData(prev => {
            if (!prev.host_company_id) {
              return { ...prev, host_company_id: String(active.id) };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching host companies:', err);
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
        fetchStockBalance();
        fetchHostCompanies();
      }
    } else {
      fetchReceipts();
      fetchStats();
      fetchPurchaseOrders();
      fetchStockItems();
      fetchWarehouses();
      fetchStockBalance();
      fetchHostCompanies();
    }
  }, []);

  useEffect(() => {
    if (formData.host_company_id && hostCompanies.length > 0) {
      const matched = hostCompanies.find(h => String(h.id) === String(formData.host_company_id));
      setSelectedHostCompany(matched || null);
    } else {
      setSelectedHostCompany(null);
    }
  }, [formData.host_company_id, hostCompanies]);

  const fetchStockBalance = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/stock/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const filteredData = (Array.isArray(data) ? data : []).filter(item => {
          const type = (item.material_type || '').toUpperCase();
          return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
        });
        setStockBalances(filteredData);
      }
    } catch (error) {
      console.error('Error fetching stock balance:', error);
    }
  };

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
        setPurchaseOrders(Array.isArray(data) ? data.filter(po => po.status !== 'DRAFT') : []);
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
          const items = (detailedPO.items || [])
            .filter(item => {
              const type = (item.material_type || '').toUpperCase();
              return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
            })
            .map(item => {
              const dQty = parseFloat(item.planned_qty || item.design_qty || 0);
              const reqWeight = parseFloat(item.required_weight || item.quantity || 0);
              
              const rawPrevRecQty = parseFloat(item.received_qty);
              const rawPrevRecWt = parseFloat(item.received_weight);
              
              const prevRecWeight = (!isNaN(rawPrevRecWt) && rawPrevRecWt > 0)
                ? rawPrevRecWt
                : (!isNaN(rawPrevRecQty) ? rawPrevRecQty : 0);
              const prevRecQty = (!isNaN(rawPrevRecQty) && rawPrevRecQty > 0 && Math.abs(rawPrevRecQty - prevRecWeight) > 0.001)
                ? rawPrevRecQty
                : (dQty > 0 && prevRecWeight >= reqWeight ? dQty : (prevRecWeight > 0 ? 1 : 0));

              const defaultCurrentQty = Math.max(0, dQty - prevRecQty);
              const defaultCurrentWeight = parseFloat(Math.max(0, reqWeight - prevRecWeight).toFixed(3));

              const rate = parseFloat(item.unit_rate || item.rate || 0);
              const isBoughtOut = (item.material_type || item.item_type || '').toUpperCase().trim().includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
              const lcStr = String(item.laser_cutting || '').trim().toUpperCase();
              const isLaser = item.laser_cutting === "With Material" || item.laser_cutting === "Without Material" ||
                              lcStr === "WITH_MATERIAL" || lcStr === "WITHOUT_MATERIAL" ||
                              lcStr.includes("WITH MATERIAL") || lcStr.includes("WITHOUT MATERIAL");
              const effectiveQty = (isLaser || isBoughtOut) ? defaultCurrentQty : defaultCurrentWeight;

              return {
                ...item,
                item_code: item.item_code || '',
                material_name: item.material_name || item.description,
                description: item.description || '',
                ordered_qty: dQty,
                ordered_weight: reqWeight,
                prev_received_qty: prevRecQty,
                prev_received_weight: prevRecWeight,
                current_receiving_qty: defaultCurrentQty,
                current_receiving_weight: defaultCurrentWeight,
                design_qty: dQty,
                quantity: reqWeight,
                received_qty: defaultCurrentQty,
                received_weight: defaultCurrentWeight,
                rate: rate,
                amount: effectiveQty * rate,
                warehouse: warehouses[0]?.warehouse_code || 'main',
                unit: item.unit || 'KG'
              };
            });

          const poHostCompanyId = detailedPO.host_company_id;
          const activeCompany = hostCompanies.find(c => c.status === 'ACTIVE') || hostCompanies[0];
          const resolvedHostCompanyId = poHostCompanyId || (activeCompany ? String(activeCompany.id) : '');

          setIsHostCompanyLocked(!!poHostCompanyId);

          setFormData({
            ...formData,
            poId,
            vendorName: selectedPO.vendor_name,
            vendorId: selectedPO.vendor_id,
            project_name: detailedPO.project_name,
            company_name: detailedPO.company_name,
            host_company_id: resolvedHostCompanyId,
            items,
            receivedQuantity: items.reduce((sum, item) => sum + parseFloat(item.received_qty || 0), 0),
            totalValuation: items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0)
          });
        }
      } catch (error) {
        console.error('Error fetching PO details:', error);
        const activeCompany = hostCompanies.find(c => c.status === 'ACTIVE') || hostCompanies[0];
        setIsHostCompanyLocked(false);
        setFormData({
          ...formData,
          poId,
          vendorName: selectedPO.vendor_name,
          vendorId: selectedPO.vendor_id,
          receivedQuantity: selectedPO.total_quantity || selectedPO.items_count || 0,
          totalValuation: selectedPO.total_amount || 0,
          items: [],
          host_company_id: activeCompany ? String(activeCompany.id) : ''
        });
      }
    } else {
      const activeCompany = hostCompanies.find(c => c.status === 'ACTIVE') || hostCompanies[0];
      setIsHostCompanyLocked(false);
      setFormData({
        ...formData,
        poId: '',
        vendorName: '',
        vendorId: '',
        receivedQuantity: 0,
        totalValuation: 0,
        items: [],
        host_company_id: activeCompany ? String(activeCompany.id) : ''
      });
    }
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();

    if (!formData.poId) {
      errorToast('Please select a purchase order');
      return;
    }

    if (!attachments || attachments.length === 0) {
      errorToast('Please upload at least one attachment / GRN Challan document');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const formDataPayload = new FormData();
      formDataPayload.append('poId', formData.poId);
      formDataPayload.append('receiptDate', formData.receiptDate);
      formDataPayload.append('receivedQuantity', formData.receivedQuantity);
      formDataPayload.append('notes', formData.notes || '');
      
      const activeItems = (formData.items || []).filter(item => {
        const currQty = parseFloat(item.current_receiving_qty !== undefined ? item.current_receiving_qty : item.received_qty) || 0;
        const currWeight = parseFloat(item.current_receiving_weight !== undefined ? item.current_receiving_weight : item.received_weight) || 0;
        return currQty > 0 || currWeight > 0;
      });
      formDataPayload.append('items', JSON.stringify(activeItems));
      if (formData.host_company_id) {
        formDataPayload.append('host_company_id', formData.host_company_id);
      }
      attachments.forEach(file => {
        formDataPayload.append('attachments', file);
      });

      const response = await fetch(`${API_BASE}/po-receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataPayload
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to create receipt');
      }

      successToast('PO Receipt created successfully');
      setShowCreateModal(false);
      setFormData({ poId: '', receiptDate: new Date().toISOString().split('T')[0], receivedQuantity: '', notes: '', items: [], host_company_id: '' });
      setAttachments([]);
      setExistingAttachments([]);
      navigate(`${deptPrefix}/po-receipts`);
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
      setExistingAttachments(data.pdf_path ? data.pdf_path.split(',').map(f => f.trim()).filter(Boolean) : []);
      setAttachments([]);
      setShowEditModal(true);
    } catch (error) {
      errorToast(error.message || 'Failed to load receipt details');
    }
  };

  const handleUpdateReceipt = async (e) => {
    e.preventDefault();

    if ((!attachments || attachments.length === 0) && (!existingAttachments || existingAttachments.length === 0)) {
      errorToast('Please upload at least one attachment / GRN Challan document');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const formDataPayload = new FormData();
      formDataPayload.append('receiptDate', editFormData.receiptDate);
      formDataPayload.append('receivedQuantity', editFormData.receivedQuantity);
      formDataPayload.append('notes', editFormData.notes || '');
      formDataPayload.append('status', editFormData.status);
      formDataPayload.append('existingAttachments', existingAttachments.join(','));
      attachments.forEach(file => {
        formDataPayload.append('attachments', file);
      });

      const response = await fetch(`${API_BASE}/po-receipts/${selectedReceipt.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataPayload
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to update receipt');
      }

      successToast('PO Receipt updated successfully');
      setShowEditModal(false);
      setAttachments([]);
      setExistingAttachments([]);
      navigate(`${deptPrefix}/po-receipts`);
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

  const handleOpenPdf = (pdfPath) => {
    window.open(`${API_BASE}/${pdfPath.replace(/\\/g, '/')}`, '_blank');
  };

  const handleDownloadGRNInvoice = async (receipt) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments/vendor-invoice/${receipt.id}/pdf?type=GRN`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate Vendor Invoice PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Vendor_Invoice_GRN-${String(receipt.id).padStart(4, '0')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      errorToast('Failed to download invoice');
    }
  };

  const handleSendToAccountsGRN = async (receipt) => {
    const grnLabel = `GRN-${String(receipt.id).padStart(4, '0')}`;
    const result = await Swal.fire({
      title: 'Send to Accounts?',
      html: `
        <div class="text-sm text-slate-600 space-y-3">
          <p>Are you sure you want to forward Goods Receipt <strong>${grnLabel}</strong> to Accounts?</p>
          <p class="text-xs text-slate-500">This will automatically create a Vendor Invoice.</p>
          <hr class="my-3 border-slate-200" />
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">📄 Preview Invoice</span>
            <button id="swal-download-invoice-btn" type="button" class="px-2.5 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded transition-all">
              Download Invoice
            </button>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Send',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4f46e5',
      didOpen: () => {
        const dlBtn = document.getElementById('swal-download-invoice-btn');
        if (dlBtn) {
          dlBtn.addEventListener('click', () => {
            handleDownloadGRNInvoice(receipt);
          });
        }
      }
    });

    if (result.isConfirmed) {
      successToast(`Goods Receipt ${grnLabel} has been forwarded to Accounts successfully.`);
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'GRN No',
      sortable: true,
      width: '12%',
      render: (val, row) => (
        <span className=" text-slate-900 text-xs font-medium">{`GRN-${String(row.id).padStart(4, '0')}`}</span>
      )
    },
    {
      label: 'Drawing',
      key: 'drawing_no',
      sortable: true,
      width: '18%',
      render: (val, row) => (
        <div className="flex flex-col">
          {row.is_merged ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full w-fit">
              <span>🟣</span> Merged GRN
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#111827] leading-[16px]">
              {row.drawing_no || '—'}
            </span>
          )}
          {row.finished_good && (
            <span className="text-[10px] text-[#6B7280] leading-[14px] mt-0.5">
              {row.finished_good}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'po_number',
      label: 'PO No',
      sortable: true,
      width: '12%',
      render: (val, row) => (
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${row.is_merged
          ? 'text-purple-700 bg-purple-50 border-purple-200'
          : 'text-slate-600 bg-slate-50 border-slate-100'
          }`}>
          #{val || 'Direct'}
        </span>
      )
    },
    {
      key: 'vendor_name',
      label: 'Supplier',
      sortable: true,
      width: '15%',
      render: (val) => (
        <span className="text-slate-900 text-xs font-medium">{val}</span>
      )
    },
    {
      key: 'project_name',
      label: 'Project / Customer',
      sortable: true,
      width: '23%',
      className: 'whitespace-normal',
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className="text-xs font-semibold text-slate-800 leading-[16px]">
            {val || '—'}
          </span>
          {row.company_name && (
            <span className="text-[10px] text-slate-500 font-medium leading-[14px] mt-0.5">
              {row.company_name}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'receipt_date',
      label: 'Receipt Date',
      sortable: true,
      width: '12%',
      render: (val) => (
        <div className="flex items-center gap-1.5 px-2 bg-slate-50 border border-slate-100 rounded text-xs  text-slate-500   inline-flex">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8%',
      render: (val) => (
        <span className={`inline-flex items-center gap-1  rounded text-xs     ${val === 'DRAFT' ? ' text-amber-700 border-amber-200' :
          val === 'RECEIVED' ? ' text-emerald-700 border-emerald-200' :
            val === 'ACKNOWLEDGED' ? ' text-blue-700 border-blue-200' :
              ' text-slate-700 border-slate-200'
          }`}>
          <div className={`w-1.5 h-1.5 rounded  ${val === 'DRAFT' ? 'bg-amber-500' :
            val === 'RECEIVED' ? 'bg-emerald-500' :
              val === 'ACKNOWLEDGED' ? 'bg-blue-500' :
                'bg-slate-500'
            }`} />
          <span className=" ">{val}</span>
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right',
      width: '6%',
      render: (_, row) => (
        <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`${deptPrefix}/po-receipts/view/${row.id}`)}
            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded  transition-all border border-indigo-50  active:scale-90"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenPdfInNewTab(row)}
            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded  transition-all border border-emerald-50  active:scale-90"
            title="Print GRN"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleSendToAccountsGRN(row)}
            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded transition-all border border-indigo-50 active:scale-90"
            title="Send to Accounts"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteReceipt(row.id)}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded  transition-all border border-rose-50  active:scale-90"
            title="Delete Receipt"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];
  const stockColumns = [
    {
      label: 'Item Code',
      key: 'item_code',
      sortable: true,
      render: (val) => <span className="text-slate-900 ">{val}</span>
    },
    {
      label: 'Material Name',
      key: 'material_name',
      sortable: true,
      render: (val) => <span className="text-slate-600 ">{val || '—'}</span>
    },
    {
      label: 'Material Type',
      key: 'material_type',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs    ">{val || '—'}</span>
    },
    {
      label: 'Warehouse',
      key: 'warehouse',
      sortable: true,
      render: (val) => <span className="text-slate-500 text-xs     bg-slate-50 px-2 py-1 rounded  border border-slate-100">{val || '—'}</span>
    },
    {
      label: 'Current Balance',
      key: 'current_balance',
      sortable: true,
      className: 'text-right',
      render: (val) => (
        <div className="flex items-center justify-end gap-2">
          <span className={`inline-block w-1.5 h-1.5 rounded  ${parseFloat(val || 0) <= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
          <span className={` text-xs ${parseFloat(val || 0) <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {parseFloat(val || 0).toFixed(3)}
          </span>
        </div>
      )
    },
    {
      label: 'Unit',
      key: 'unit',
      sortable: true,
      render: (val) => <span className="text-slate-400text-xs   ">{val || 'NOS'}</span>
    }
  ];

  if (showCreateModal) {
    return (
      <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`${deptPrefix}/po-receipts`)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              title="Back to List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Create GRN Request</h1>
              <p className="text-xs text-slate-500">Record incoming goods receipts against approved Purchase Orders</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`${deptPrefix}/po-receipts`)}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateReceipt}
              disabled={formData.items.length === 0}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-200 active:scale-95 ${
                formData.items.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-blue-700'
              }`}
            >
              Create GRN Request
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateReceipt} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm relative">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-2">
            {/* Sidebar: Receipt Context */}
            <div className="lg:col-span-1 space-y-4 border-r border-slate-100 pr-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Receipt Context</h4>
                    <p className="text-[10px] text-slate-400">Link source and set date</p>
                  </div>
                </div>

                <FormControl label="GRN Number">
                  <input
                    type="text"
                    value={`GRN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(receipts.length + 1).padStart(4, '0')}`}
                    readOnly
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                </FormControl>

                <FormControl label="Select Drawing *">
                  <SearchableSelect
                    options={purchaseOrders.filter(po => po.drawing_no).map(po => ({
                      label: `${po.drawing_no} - ${po.finished_good || 'No description'}`,
                      value: String(po.id)
                    }))}
                    value={formData.poId || ''}
                    onChange={(e) => handlePoChange(e.target.value)}
                    placeholder="Search & Select Drawing No..."
                    allowCustom={false}
                  />
                </FormControl>

                <FormControl label="Receipt Date *">
                  <input
                    type="date"
                    value={formData.receiptDate}
                    onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </FormControl>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-500">
                    <ClipboardCheck className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">Drawing & PO Info</h4>
                    <p className="text-[10px] text-slate-400">Auto-fetched drawing context</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-100 space-y-3">
                  {formData.poId ? (() => {
                    const poDetails = purchaseOrders.find(po => String(po.id) === String(formData.poId));
                    const orderedQty = formData.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
                    const receivedQty = formData.items.reduce((sum, item) => sum + parseFloat(item.received_qty || 0), 0);
                    const pendingQty = Math.max(0, orderedQty - receivedQty);

                    return (
                      <div className="space-y-2 text-xs animate-in fade-in duration-300">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Drawing No.</span>
                          <span className="text-xs font-bold text-slate-800">{poDetails?.drawing_no || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Finished Good</span>
                          <span className="text-xs font-medium text-slate-700 block whitespace-normal leading-normal">{poDetails?.finished_good || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">PO Number</span>
                          <span className="text-xs font-semibold text-slate-700">{poDetails?.po_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Supplier</span>
                          <span className="text-xs font-bold text-slate-850">{formData.vendorName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Project No.</span>
                          <span className="text-xs font-semibold text-slate-700">{formData.project_name || '—'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                          <div>
                            <span className="text-[9px] text-slate-400 font-semibold uppercase block">Ordered</span>
                            <span className="text-[11px] font-semibold text-slate-700">{orderedQty}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-semibold uppercase block">Received</span>
                            <span className="text-[11px] font-semibold text-emerald-600">{receivedQty}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-semibold uppercase block">Pending</span>
                            <span className="text-[11px] font-semibold text-rose-600">{pendingQty}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-400 italic">No Drawing Selected</p>
                      <p className="text-[9px] text-slate-400 mt-1">Select a drawing above to fetch details</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Host Billing Entity Details */}
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-rose-50 rounded flex items-center justify-center text-rose-600">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">Host Billing Entity Details</h4>
                    <p className="text-[10px] text-slate-400">Issuing profile for this request</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-medium ml-1">Select Issuing Billing Profile *</label>
                    <select
                      value={formData.host_company_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, host_company_id: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer font-medium text-slate-700"
                      disabled={isHostCompanyLocked}
                    >
                      <option value="">Select billing profile...</option>
                      {hostCompanies.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                        </option>
                      ))}
                    </select>
                    {isHostCompanyLocked && (
                      <p className="text-[8px] text-indigo-500 italic mt-0.5 ml-1">Autofetched and locked from linked Purchase Order</p>
                    )}
                  </div>

                  {selectedHostCompany && (
                    <div className="pt-2 border-t border-slate-200/60 flex flex-col items-center text-center animate-in fade-in duration-300">
                      {selectedHostCompany.company_logo ? (
                        <img
                          src={getFileUrl(selectedHostCompany.company_logo)}
                          alt="Logo"
                          className="h-10 max-w-full object-contain mb-1.5 bg-white border border-slate-100 p-0.5 rounded shadow-sm"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs mb-1">
                          {selectedHostCompany.company_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-slate-800 truncate w-full">{selectedHostCompany.company_name}</span>
                      <span className={`text-[8px] mt-1 px-2 py-0.5 rounded-full font-semibold border ${selectedHostCompany.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                        {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content: Receipt Items */}
            <div className="lg:col-span-3 space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Receipt Items</h3>
                    <p className="text-xs text-slate-400">Verify received quantities against PO</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80">
                    <tr className="text-[11px] text-slate-500 border-b border-slate-200 font-semibold uppercase">
                      <th className="p-3 pl-4">Drawing No</th>
                      <th className="p-3">Item ID</th>
                      <th className="p-3">Material Name & Dimensions</th>
                      <th className="p-3 text-center">Ordered Qty</th>
                      <th className="p-3 text-center">Ordered Weight</th>
                      <th className="p-3 text-center">Prev. Received</th>
                      <th className="p-3 text-center">Receiving Qty (Nos)</th>
                      <th className="p-3 text-center">Receiving Weight (Kg)</th>
                      <th className="p-3 text-center">Pending Qty</th>
                      <th className="p-3 text-center">Pending Weight</th>
                      <th className="p-3 text-center">Rate</th>
                      <th className="p-3 text-right pr-4">Amount</th>
                      <th className="p-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData.items.map((item, idx) => {
                      const isBoughtOut = (item.material_type || item.item_type || '').toUpperCase().trim().includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
                      const ordQty = parseFloat(item.ordered_qty || item.design_qty || (isBoughtOut ? item.quantity : 0) || 0);
                      const ordWeight = isBoughtOut ? 0 : parseFloat(item.ordered_weight || item.quantity || 0);
                      const prevQty = parseFloat(item.prev_received_qty || 0);
                      const prevWeight = isBoughtOut ? 0 : parseFloat(item.prev_received_weight || 0);
                      const isFullyReceived = ordQty - prevQty <= 0;
                      const currQty = parseFloat(item.current_receiving_qty !== undefined ? item.current_receiving_qty : item.received_qty) || 0;
                      const currWeight = isBoughtOut ? 0 : (parseFloat(item.current_receiving_weight !== undefined ? item.current_receiving_weight : (item.received_weight || 0)) || 0);

                      const pendingQty = Math.max(0, ordQty - (prevQty + currQty));
                      const pendingWeight = isBoughtOut ? 0 : parseFloat(Math.max(0, ordWeight - (prevWeight + currWeight)).toFixed(3));

                      return (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-all text-xs">
                          <td className="p-3 pl-4 font-bold text-slate-900">
                            <input
                              type="text"
                              value={item.drawing_no || ''}
                              placeholder="Drawing No"
                              onChange={(e) => handleItemChange(idx, 'drawing_no', e.target.value)}
                              className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col min-w-[150px]">
                              <SearchableSelect
                                options={stockItems}
                                value={item.item_code}
                                onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                                placeholder="Select Item ID"
                                labelField="item_code"
                                valueField="item_code"
                                subLabelField="material_name"
                                allowCustom={true}
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1 min-w-[200px]">
                              <SearchableSelect
                                options={stockItems}
                                value={item.material_name}
                                onChange={(e) => {
                                  handleItemChange(idx, 'material_name', e.target.value);
                                  const selectedItem = stockItems.find(it => it.material_name === e.target.value);
                                  if (selectedItem) {
                                    handleItemChange(idx, 'item_code', selectedItem.item_code);
                                  }
                                }}
                                placeholder="Select Material Name"
                                labelField="material_name"
                                valueField="material_name"
                                subLabelField="item_code"
                                allowCustom={true}
                              />
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-semibold text-slate-400 uppercase">Store:</span>
                                <select
                                  value={item.warehouse || 'main'}
                                  onChange={(e) => handleItemChange(idx, 'warehouse', e.target.value)}
                                  className="bg-transparent text-xs text-slate-600 outline-none border-b border-slate-200 cursor-pointer font-medium pb-0.5"
                                >
                                  {warehouses.length > 0 ? (
                                    warehouses.map(w => (
                                      <option key={w.id} value={w.warehouse_code}>{w.warehouse_name || w.warehouse_code}</option>
                                    ))
                                  ) : (
                                    <option value="main">Main Warehouse</option>
                                  )}
                                </select>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-semibold text-slate-800">{ordQty.toFixed(0)}</span>
                            <span className="text-[10px] text-slate-400 ml-1">Nos</span>
                          </td>
                          <td className="p-3 text-center">
                            {isBoughtOut ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : (
                              <>
                                <span className="font-semibold text-indigo-600">{ordWeight.toFixed(3)}</span>
                                <span className="text-[10px] text-slate-400 ml-1">Kg</span>
                              </>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center text-[11px]">
                              <span className="font-medium text-slate-700">{prevQty.toFixed(0)} Nos</span>
                              <span className="text-[10px] text-slate-400">{isBoughtOut ? '—' : `${prevWeight.toFixed(3)} Kg`}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              value={item.current_receiving_qty !== undefined ? item.current_receiving_qty : item.received_qty}
                              disabled={isFullyReceived}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                const maxAllowed = Math.max(0, ordQty - prevQty);
                                const cappedVal = val === '' ? '' : Math.min(val, maxAllowed);
                                handleItemChange(idx, 'current_receiving_qty', cappedVal);
                                handleItemChange(idx, 'received_qty', cappedVal);
                              }}
                              max={Math.max(0, ordQty - prevQty)}
                              className={`w-16 p-1.5 border rounded-lg text-center text-xs font-semibold focus:ring-2 outline-none ${
                                isFullyReceived 
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                                  : 'bg-white border-blue-200 text-blue-600 focus:ring-blue-500/20'
                              }`}
                              placeholder="0"
                            />
                          </td>
                          <td className="p-3 text-center">
                            {isBoughtOut ? (
                              <input
                                type="text"
                                value=""
                                placeholder="—"
                                disabled={true}
                                readOnly={true}
                                className="w-20 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-400 font-medium outline-none cursor-not-allowed"
                              />
                            ) : (
                              <input
                                type="number"
                                step="0.001"
                                value={item.current_receiving_weight !== undefined && item.current_receiving_weight !== null ? item.current_receiving_weight : (item.received_weight !== undefined ? item.received_weight : '')}
                                readOnly
                                className="w-20 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500 font-semibold outline-none cursor-not-allowed"
                                placeholder="0.000"
                              />
                            )}
                          </td>
                          <td className="p-3 text-center font-semibold text-amber-600">
                            {pendingQty.toFixed(0)} <span className="text-[9px] text-slate-400 font-normal">Nos</span>
                          </td>
                          <td className="p-3 text-center font-semibold text-amber-600">
                            {isBoughtOut ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : (
                              <>{pendingWeight.toFixed(3)} <span className="text-[9px] text-slate-400 font-normal">Kg</span></>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              value={item.rate !== undefined && item.rate !== null ? item.rate : (item.unit_rate || '')}
                              onChange={(e) => {
                                const rateVal = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                handleItemChange(idx, 'rate', rateVal);
                                handleItemChange(idx, 'unit_rate', rateVal);
                              }}
                              className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-center text-xs text-emerald-600 font-semibold outline-none"
                            />
                          </td>
                          <td className="p-3 text-right pr-4">
                            <div className="flex flex-col items-end">
                              <span className="text-slate-900 text-xs font-bold">
                                {(() => {
                                    const lcStr = String(item.laser_cutting || '').trim().toUpperCase();
                                    const isLaser = item.laser_cutting === "With Material" || item.laser_cutting === "Without Material" || 
                                                    lcStr === "WITH_MATERIAL" || lcStr === "WITHOUT_MATERIAL" ||
                                                    lcStr.includes("WITH MATERIAL") || lcStr.includes("WITHOUT MATERIAL");
                                    const effectiveQty = (isLaser || isBoughtOut) ? currQty : currWeight;
                                    const rate = parseFloat(item.rate || item.unit_rate) || 0;
                                    return formatCurrency(effectiveQty * rate);
                                  })()}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {isFullyReceived ? (
                              <span className="text-[10px] text-emerald-600 font-semibold px-2 py-0.5 bg-emerald-50 rounded">
                                Locked
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {formData.items.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No Items Added</p>
                    <p className="text-xs text-slate-400 mt-1">Select a drawing to populate receipt line items</p>
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/80 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Attachments & Documents <span className="text-rose-500">*</span></h4>
                    <p className="text-[10px] text-slate-400">Upload vendor invoice, challan, or material test certificates</p>
                  </div>
                </div>

                <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors bg-white/50 group">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAttachments(prev => [...prev, ...files]);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Click or drag files here to upload GRN / Challan Documents</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG, JPEG (Multiple files allowed)</p>
                    </div>
                  </div>
                </div>

                {attachments && attachments.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                    {attachments.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs shadow-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{doc.name}</p>
                            <p className="text-[10px] text-slate-400">{(doc.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachments(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all hover:bg-rose-50 active:scale-95 shrink-0"
                          title="Remove Document"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Bar */}
          <div className="border-t border-slate-200 p-4 mt-6 flex items-center justify-between bg-slate-50 rounded-xl">
            <div className="flex items-center gap-12">
              <div>
                <p className="text-xs text-slate-500 font-semibold">Total Quantity</p>
                <p className="text-xl font-bold text-slate-900">{formData.receivedQuantity || 0} <span className="text-xs text-slate-400 font-normal ml-1">Units</span></p>
              </div>
              <div className="h-10 w-[1px] bg-slate-200"></div>
              <div>
                <p className="text-xs text-emerald-600 font-semibold">Total Valuation</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(formData.totalValuation || 0)}</p>
              </div>
              <div className="h-10 w-[1px] bg-slate-200"></div>
              <div>
                <p className="text-xs text-indigo-600 font-semibold">Grand Total (18% GST)</p>
                <p className="text-xl font-bold text-indigo-600">{formatCurrency((formData.totalValuation || 0) * 1.18)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`${deptPrefix}/po-receipts`)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formData.items.length === 0}
                className={`flex items-center gap-2 px-8 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-200 active:scale-95 ${
                  formData.items.length === 0 ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-blue-700'
                }`}
              >
                Create GRN Request
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-in p-4 fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded  text-white shadow-indigo-200 ">
            <Warehouse className="w-3 h-3" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs  text-slate-400   ">
              <span>Buying</span>
              <ChevronRight className="w-2.5 h-2.5" />
              <span>Procurement</span>
            </div>
            <h1 className="text-xl  text-slate-900 ">Purchase Receipts</h1>
            <p className="text-xs text-slate-500 ">Process material receipts and quality inspections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded  border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2  p-2  rounded text-xs   transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900  border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              KANBAN
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2  p-2  rounded text-xs   transition-all ${viewMode === 'list' ? 'bg-white text-slate-900  border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-3.5 h-3.5" />
              LIST
            </button>
          </div>
          <button
            onClick={fetchReceipts}
            className="p-2 text-slate-500 hover:bg-white hover:text-blue-600 rounded  transition-all border border-slate-200  active:scale-95 bg-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate(`${deptPrefix}/po-receipts/add`)}
            className="flex items-center gap-2  p-2  bg-blue-600 text-white rounded  text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create GRN
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 my-5 gap-2">
        {[
          { label: 'Total Receipts', value: stats?.total_receipts, sub: 'Total processing requests', icon: ClipboardCheck, color: 'blue', bg: 'bg-blue-600', text: 'text-white', subText: 'text-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white' },
          { label: 'Pending QC', value: stats?.draft_receipts, sub: 'Awaiting initial check', icon: History, color: 'orange', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
          { label: 'QC Review', value: stats?.qc_review_count || 0, sub: 'Quality check in progress', icon: Search, color: 'indigo', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
          { label: 'Awaiting Storage', value: stats?.awaiting_storage || 0, sub: 'Pending warehouse entry', icon: Package, color: 'blue', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
          { label: 'Completed', value: stats?.received_receipts, sub: 'Successfully stored', icon: CheckCircle2, color: 'emerald', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          { label: 'Rejected', value: stats?.rejected_count || 0, sub: 'Failed quality criteria', icon: AlertCircle, color: 'rose', bg: 'bg-white', text: 'text-slate-800', subText: 'text-slate-400', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.bg} border border-slate-200 rounded  p-2  hover: transition-all relative overflow-hidden group`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <p className={`text-xs  ${stat.bg === 'bg-white' ? 'text-slate-500' : 'text-blue-100'}  `}>{stat.label}</p>
                <div className={`p-2 ${stat.iconBg} border border-slate-100/10 ${stat.iconColor} rounded  `}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-xl  ${stat.text} `}>{stat.value || 0}</p>
              <p className={`text-xs ${stat.subText} mt-1   er opacity-80`}>{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center my-5 gap-2">
        <div className="flex bg-white p-1 rounded  border border-slate-200 ">
          <button
            onClick={() => navigate(`${deptPrefix}/po-receipts`)}
            className={`flex items-center gap-2  p-2 rounded  text-xs  transition-all ${activeTab === 'grn' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FileText className="w-4 h-4" />
            GRN Request
          </button>
          <button
            onClick={() => navigate(`${deptPrefix}/po-receipts/stocks`)}
            className={`flex items-center gap-2  p-2 rounded  text-xs  transition-all ${activeTab === 'stocks' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Package className="w-4 h-4" />
            Available Stocks
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center my-4 gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by Drawing No., Finished Good, GRN No., PO No., Project No., or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded  text-xs focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all "
          />
          <Search className="w-3 h-3 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex items-center gap-2  p-2  bg-white border border-slate-200 rounded  ">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400   ">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs  text-blue-600 outline-none bg-transparent cursor-pointer"
          >
            <option value="ALL">ALL STATUS</option>
            <option value="DRAFT">DRAFT</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          </select>
        </div>

        <button className="p-2 bg-emerald-500 text-white rounded  hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95">
          <Filter className="w-3 h-3" />
        </button>
      </div>

      {/* Main Table Section */}
      <div className=" rounded overflow-hidden">
        {activeTab === 'grn' ? (
          <DataTable
            columns={columns}
            data={receipts.filter(r => {
              const grnCode = `GRN-${String(r.id).padStart(4, '0')}`;
              const matchesSearch = !searchTerm ||
                String(r.id).includes(searchTerm) ||
                grnCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.drawing_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.finished_good?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
              return matchesSearch && matchesStatus;
            })}
            loading={loading}
            pageSize={5}
            hideHeader={true}
            className="border-none shadow-none rounded-none"
          />
        ) : (
          <DataTable
            columns={stockColumns}
            data={stockBalances.filter(s => {
              const matchesSearch = !searchTerm ||
                s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.material_name?.toLowerCase().includes(searchTerm.toLowerCase());
              return matchesSearch;
            })}
            loading={loading}
            pageSize={5}
            hideHeader={true}
            className="border-none shadow-none rounded-none"
            searchPlaceholder="Search available stocks..."
            emptyMessage="No available stocks found"
          />
        )}
      </div>

      {/* GRN View Details Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => navigate(`${deptPrefix}/po-receipts`)}
        title={selectedReceiptForView ? `GRN Details - GRN-${String(selectedReceiptForView.id).padStart(4, '0')}` : 'GRN Details'}
        size="6xl"
      >
        {selectedReceiptForView && (
          <div className="p-2 space-y-2 bg-slate-50/30">
            {/* Header Status & Date */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs  text-slate-500  ">Status</span>
                <div className={`flex items-center gap-2  p-1 rounded  border text-xs    ${selectedReceiptForView.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  selectedReceiptForView.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                  {selectedReceiptForView.status === 'RECEIVED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded  ${selectedReceiptForView.status === 'DRAFT' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                  )}
                  {selectedReceiptForView.status}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs  text-slate-500  ">Receipt Date</span>
                <span className="text-xs  text-slate-900">
                  {new Date(selectedReceiptForView.receipt_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Reference & Supplier Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white border border-slate-200 rounded   space-y-3 hover:border-indigo-100 transition-colors">
                <div className="flex items-center gap-2  text-indigo-500">
                  <Warehouse className="w-4 h-4" />
                  <span className="text-xs  text-slate-400  ">PO Reference</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 rounded ">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-xs  text-slate-900  ">#{selectedReceiptForView.po_number || 'Direct'}</span>
                </div>
              </div>

              <div className="p-2 bg-white border border-slate-200 rounded   space-y-3 hover:border-blue-100 transition-colors">
                <div className="flex items-center gap-2  text-blue-500">
                  <User className="w-4 h-4" />
                  <span className="text-xs  text-slate-400  ">Supplier</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded ">
                    <Warehouse className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs  text-slate-900  ">{selectedReceiptForView.vendor_name}</span>
                    <span className="text-[10px] text-slate-400">Supplier ID: #{selectedReceiptForView.vendor_id}</span>
                  </div>
                </div>
              </div>

              {selectedReceiptForView.project_name && (
                <div className="p-2 bg-white border border-slate-200 rounded   space-y-3 hover:border-emerald-100 transition-colors">
                  <div className="flex items-center gap-2  text-emerald-500">
                    <Package className="w-4 h-4" />
                    <span className="text-xs  text-slate-400  ">Project / Customer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 rounded ">
                      <Building2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs  text-slate-900  ">{selectedReceiptForView.project_name}</span>
                      {selectedReceiptForView.company_name && (
                        <span className="text-[10px] text-slate-400">{selectedReceiptForView.company_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const receiptHostCompany = selectedReceiptForView.host_company_id
                  ? hostCompanies.find(h => String(h.id) === String(selectedReceiptForView.host_company_id))
                  : null;
                return receiptHostCompany ? (
                  <div className="p-2 bg-white border border-slate-200 rounded   space-y-3 hover:border-rose-100 transition-colors">
                    <div className="flex items-center gap-2  text-rose-500">
                      <Building2 className="w-4 h-4" />
                      <span className="text-xs  text-slate-400  ">Host Billing Profile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-rose-50 rounded ">
                        {receiptHostCompany.company_logo ? (
                          <img
                            src={getFileUrl(receiptHostCompany.company_logo)}
                            alt="Logo"
                            className="h-8 w-8 object-contain bg-white rounded border border-slate-100"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-rose-600" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-900">{receiptHostCompany.company_name}</span>
                        <span className="text-[10px] text-slate-400">Issuing Billing Entity</span>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Received Items Table */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-50 rounded  flex items-center justify-center text-indigo-600">
                  <Package className="w-4 h-4" />
                </div>
                <h4 className="text-xs  text-slate-900  ">Received Items</h4>
              </div>

              <div className="bg-white border border-slate-200 rounded  overflow-visible ">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr className="text-xs text-slate-400 border-b border-slate-200">
                      <th className="p-2">Drawing No</th>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Design Qty</th>
                      <th className="p-2 text-center">Required Weight</th>
                      <th className="p-2 text-center">Received Qty</th>
                      <th className="p-2 text-center">Received Weight</th>
                      <th className="p-2 text-center">Pending Qty</th>
                      <th className="p-2 text-center">Pending Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(isViewEditMode ? viewEditItems : (selectedReceiptForView.items || [])).map((item, idx) => {
                      const isBoughtOut = (item.material_type || item.item_type || '').toUpperCase().trim().includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
                      const dQty = parseFloat(item.planned_qty || item.design_qty || (isBoughtOut ? (item.quantity || item.received_quantity) : 0) || 0);
                      const reqWt = isBoughtOut ? 0 : parseFloat(item.required_qty || item.expected_quantity || item.quantity || 0);
                      
                      const rawRecQty = parseFloat(item.received_qty);
                      const rawRecWt = parseFloat(item.received_weight);
                      
                      const recWt = isBoughtOut ? 0 : ((!isNaN(rawRecWt) && rawRecWt > 0) ? rawRecWt : parseFloat(item.received_quantity || 0));
                      const recQty = (!isNaN(rawRecQty) && rawRecQty > 0) ? rawRecQty : dQty;

                      const cumQty = parseFloat(item.cumulative_received_qty !== undefined ? item.cumulative_received_qty : recQty) || recQty;
                      const cumWt = isBoughtOut ? 0 : (parseFloat(item.cumulative_received_weight !== undefined ? item.cumulative_received_weight : recWt) || recWt);

                      const pQty = Math.max(0, dQty - cumQty);
                      const pWt = isBoughtOut ? 0 : parseFloat(Math.max(0, reqWt - cumWt).toFixed(3));
                      const unitStr = isBoughtOut ? 'NOS' : (item.unit || 'KG').toUpperCase();

                      return (
                        <tr key={idx} className={`group transition-colors ${isViewEditMode ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-slate-50/50'}`}>
                          {/* Drawing No */}
                          <td className="p-2 text-xs font-bold text-slate-900">
                            {isViewEditMode ? (
                              <input
                                type="text"
                                value={item.drawing_no || ''}
                                onChange={e => handleViewItemChange(idx, 'drawing_no', e.target.value)}
                                placeholder="Drawing No"
                                className="w-28 px-2 py-1 border border-blue-300 rounded text-xs focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                              />
                            ) : (
                              item.drawing_no || '—'
                            )}
                          </td>

                          {/* Item */}
                          <td className="p-2">
                            <div className="text-xs text-slate-900 font-medium">{item.item_code}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{item.material_name || item.description}</div>
                            {formatDimensions(item) && (
                              <div className="mt-1">
                                <span className="text-xs text-slate-400">{formatDimensions(item)}</span>
                              </div>
                            )}
                          </td>

                          {/* Design Qty (NOS) */}
                          <td className="p-2 text-center text-slate-500 text-xs">
                            {isViewEditMode ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={(item.planned_qty === 0 || item.design_qty === 0) ? 0 : (item.planned_qty || item.design_qty || '')}
                                  onChange={e => {
                                    handleViewItemChange(idx, 'planned_qty', e.target.value);
                                    handleViewItemChange(idx, 'design_qty', e.target.value);
                                  }}
                                  className="w-20 px-2 py-1 border border-blue-300 rounded text-xs text-center focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                                />
                                <span className="text-xs text-slate-400 uppercase tracking-wider">NOS</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span>{dQty.toFixed(0)}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">NOS</span>
                              </div>
                            )}
                          </td>

                          {/* Required Weight */}
                          <td className="p-2 text-center text-slate-500 text-xs">
                            {isBoughtOut ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : isViewEditMode ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={(item.required_qty === 0 || item.expected_quantity === 0 || item.quantity === 0) ? 0 : (item.required_qty || item.expected_quantity || item.quantity || '')}
                                  onChange={e => handleViewItemChange(idx, 'required_qty', e.target.value)}
                                  className="w-24 px-2 py-1 border border-blue-300 rounded text-xs text-center focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                                />
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{unitStr}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-slate-700 font-medium">{reqWt.toFixed(3)}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{unitStr}</span>
                              </div>
                            )}
                          </td>

                          {/* Received Qty (NOS) */}
                          <td className="p-2 text-center text-slate-900 text-xs">
                            {isViewEditMode ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={item.received_qty === 0 ? 0 : (item.received_qty || '')}
                                  onChange={e => handleViewItemChange(idx, 'received_qty', e.target.value)}
                                  className="w-20 px-2 py-1 border border-blue-300 rounded text-xs text-center focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                                />
                                <span className="text-xs text-slate-400 uppercase tracking-wider">NOS</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-blue-600">{recQty.toFixed(0)}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">NOS</span>
                              </div>
                            )}
                          </td>

                          {/* Received Weight (KG) */}
                          <td className="p-2 text-center text-slate-900 text-xs">
                            {isBoughtOut ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : isViewEditMode ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={item.received_weight === 0 ? 0 : (item.received_weight || item.received_quantity || '')}
                                  onChange={e => handleViewItemChange(idx, 'received_weight', e.target.value)}
                                  className="w-24 px-2 py-1 border border-blue-300 rounded text-xs text-center focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                                />
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{unitStr}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-indigo-600">{recWt.toFixed(3)}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{unitStr}</span>
                              </div>
                            )}
                          </td>

                          {/* Pending Qty (NOS) */}
                          <td className="p-2 text-center text-amber-600 font-semibold text-xs">
                            <div className="flex flex-col items-center">
                              <span>{pQty.toFixed(0)}</span>
                              <span className="text-xs text-slate-400 uppercase tracking-wider">NOS</span>
                            </div>
                          </td>

                          {/* Pending Weight (KG) */}
                          <td className="p-2 text-center text-amber-600 font-semibold text-xs">
                            {isBoughtOut ? (
                              <span className="text-slate-400 font-medium">—</span>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span>{pWt.toFixed(3)}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{unitStr}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attachments Section in View Modal */}
            {existingAttachments && existingAttachments.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 rounded flex items-center justify-center text-indigo-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-905">Attachments & Documents</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 border border-slate-200/60 rounded">
                  {existingAttachments.map((file, idx) => {
                    const rawName = file.split('/').pop() || file.split('\\').pop() || '';
                    const parts = rawName.split('-');
                    const fileName = parts.length > 1 ? parts.slice(1).join('-') : rawName;
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/60 rounded hover:bg-slate-100/70 transition-all">
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-xs text-slate-700 truncate font-semibold" title={fileName}>{fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(file)}
                          className="p-1 bg-white border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition-all hover:bg-indigo-50 active:scale-95 shrink-0"
                          title="View Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPdfInNewTab(selectedReceiptForView)}
                  className="flex items-center gap-2 p-2 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  PRINT GRN
                </button>
                <button
                  onClick={() => handleDownloadGRNInvoice(selectedReceiptForView)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD INVOICE
                </button>
                {!isViewEditMode ? (
                  <button
                    onClick={handleEnterViewEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    <FileEdit className="w-4 h-4" />
                    Edit Items
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveViewEdits}
                      disabled={isSavingViewEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-60"
                    >
                      {isSavingViewEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isSavingViewEdit ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={handleCancelViewEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => { setIsViewEditMode(false); setViewEditItems([]); navigate(`${deptPrefix}/po-receipts`); }}
                className="px-8 py-2.5 bg-emerald-500 text-white rounded text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => navigate(`${deptPrefix}/po-receipts`)} title="Edit PO Receipt" size="xl">
        <form onSubmit={handleUpdateReceipt} className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormControl label="Receipt Date *">
              <input
                type="date"
                value={editFormData.receiptDate}
                onChange={(e) => setEditFormData({ ...editFormData, receiptDate: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded text-xs  text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                required
              />
            </FormControl>
            <FormControl label="Status *">
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded text-xs  text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                required
              >
                <option value="DRAFT">Draft</option>
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
              onChange={(e) => setEditFormData({ ...editFormData, receivedQuantity: e.target.value })}
              className="w-full p-2 bg-white border border-slate-200 rounded text-xs  text-indigo-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            />
          </FormControl>

          <FormControl label="Notes (Optional)">
            <textarea
              value={editFormData.notes}
              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              className="w-full p-2 bg-white border border-slate-200 rounded text-xs  text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              rows="3"
            />
          </FormControl>

          {/* Attachments Section in Edit Modal */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Attachments & Documents <span className="text-red-500">*</span></h3>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded p-4 text-center hover:border-indigo-300 transition-all cursor-pointer bg-slate-50/50 group relative">
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setAttachments(prev => [...prev, ...files]);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept=".pdf,.png,.jpg,.jpeg"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="p-2 bg-indigo-50 rounded text-indigo-600 group-hover:bg-indigo-100 transition-all">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Click or drag files here to upload GRN / Challan Documents</p>
                <p className="text-[10px] text-slate-400">PDF, PNG, JPG, JPEG (Multiple files allowed)</p>
              </div>
            </div>

            {((existingAttachments && existingAttachments.length > 0) || (attachments && attachments.length > 0)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 font-sans">
                {/* Existing Attachments */}
                {existingAttachments.map((file, idx) => {
                  const rawName = file.split('/').pop() || file.split('\\').pop() || '';
                  const parts = rawName.split('-');
                  const fileName = parts.length > 1 ? parts.slice(1).join('-') : rawName;
                  return (
                    <div key={`existing-${idx}`} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/60 rounded hover:bg-slate-100/70 transition-all">
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs text-slate-700 truncate font-semibold" title={fileName}>{fileName}</span>
                          <span className="text-[9px] text-slate-400 font-medium">Existing Document</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(file)}
                          className="p-1 bg-white border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition-all hover:bg-indigo-50 active:scale-95"
                          title="View Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExistingAttachments(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all hover:bg-rose-50 active:scale-95"
                          title="Delete Document"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Staged New Attachments */}
                {attachments.map((file, idx) => (
                  <div key={`staged-${idx}`} className="flex items-center justify-between p-2.5 bg-indigo-50/20 border border-indigo-100/60 rounded hover:bg-indigo-50/40 transition-all">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs text-indigo-950 truncate font-semibold" title={file.name}>{file.name}</span>
                        <span className="text-[9px] text-indigo-600 font-medium">Staged - {(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachments(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1 bg-white border border-indigo-100/40 rounded text-indigo-400 hover:text-rose-600 hover:border-rose-100 transition-all hover:bg-rose-50 active:scale-95 shrink-0"
                      title="Remove Document"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate(`${deptPrefix}/po-receipts`)}
              className="p-2 border border-slate-200 rounded text-xs  text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="p-2 bg-blue-600 text-white rounded text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
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

