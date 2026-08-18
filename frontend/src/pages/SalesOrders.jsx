import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, FormControl, StatusBadge, Badge, SearchableSelect, Tabs, Button } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { Truck, User } from 'lucide-react';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import {
  Eye,
  Download,
  Pencil,
  Trash2,
  Plus,
  Package,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Calendar,
  DollarSign,
  Check,
  GitBranch,
  MapPin,
  Search
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { cleanProjectName } from '../utils/formatters';
import { getFileUrl } from '../utils/url';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const warehouseOptions = [
  { value: 'RM', label: 'Raw Material Warehouse' },
  { value: 'WIP', label: 'Production Issue (WIP)' },
  { value: 'FG', label: 'Finished Goods' },
  { value: 'SUB', label: 'Subcontract Store' },
  { value: 'REJECT', label: 'Rejected Store' }
];

const SalesOrders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [formMode, setFormMode] = useState('create'); // 'create', 'edit', 'view'
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [boms, setBoms] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [user, setUser] = useState(null);
  const [previewDrawing, setPreviewDrawing] = useState(null);
  const [hostCompanies, setHostCompanies] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedHostCompany, setSelectedHostCompany] = useState(null);
  const [allCustomerPos, setAllCustomerPos] = useState([]);
  const [allDrawings, setAllDrawings] = useState([]);

  const [extraLoading, setExtraLoading] = useState(false);

  useEffect(() => {
    if (selectedHostId && hostCompanies.length > 0) {
      const matched = hostCompanies.find(h => String(h.id) === String(selectedHostId));
      setSelectedHostCompany(matched || null);
    }
  }, [selectedHostId, hostCompanies]);

  const initialFormState = {
    series: 'Auto-generated',
    projectName: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    orderType: 'Sales',
    customerId: '',
    customerEmail: '',
    customerPhone: '',
    customerContactPerson: '',
    customerType: '',
    customerGstin: '',
    customerCity: '',
    customerState: '',
    customerBillingAddress: '',
    customerShippingAddress: '',
    customerPoId: '',
    drawingId: '',
    drawingNo: '',
    finishedGoodName: '',
    designQty: '',
    poNumber: '',
    clientName: '',
    orderQuantity: 1,
    warehouse: '',
    status: 'Draft',
    cgstRate: 9,
    sgstRate: 9,
    profitMargin: 0,
    totalProfit: 0,
    sourceType: 'DIRECT',
    items: []
  };

  const [formData, setFormData] = useState(initialFormState);

  const memoizedPoOptions = React.useMemo(() => {
    // Find currently selected drawing details
    const selectedDwgObj = allDrawings.find(d => String(d.drawing_master_id || d.id) === String(formData.drawingId));
    const targetDrawingNo = selectedDwgObj?.drawing_no;

    // Filter PO items to match selected drawing
    let filteredPos = allCustomerPos;
    if (targetDrawingNo) {
      filteredPos = allCustomerPos.map(po => ({
        ...po,
        items: po.items.filter(item => 
          String(item.drawing_no || '').trim().toUpperCase() === String(targetDrawingNo).trim().toUpperCase()
        )
      })).filter(po => po.items.length > 0);
    }

    // Sort filtered Customer POs by latest PO Date (descending)
    const sortedPos = [...filteredPos].sort((a, b) => {
      const dateValA = a.po_date || a.created_at;
      const dateValB = b.po_date || b.created_at;
      const dateA = dateValA ? new Date(dateValA).getTime() : 0;
      const dateB = dateValB ? new Date(dateValB).getTime() : 0;
      return dateB - dateA;
    });

    const options = [];

    sortedPos
      .filter(po => po.items && po.items.length > 0)
      .forEach(po => {
        const dateVal = po.po_date || po.created_at;
        const formattedDate = dateVal
          ? new Date(dateVal).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
          : '—';
        po.items.forEach((item) => {
          options.push({
            value: String(po.uniqueKey),
            label: `(${po.po_number || '—'}) | PO Date: ${formattedDate} | ${item.drawing_no || '—'} – ${item.description || '—'}`
          });
        });
      });

    if (!targetDrawingNo) {
      sortedPos
        .filter(po => !po.items || po.items.length === 0)
        .forEach(po => {
          const dateVal = po.po_date || po.created_at;
          const formattedDate = dateVal
            ? new Date(dateVal).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
            : '—';
          options.push({
            value: String(po.uniqueKey),
            label: `(${po.po_number || '—'}) | PO Date: ${formattedDate} | ${po.company_name || ''}`
          });
        });
    }

    return options;
  }, [formData.drawingId, allDrawings, allCustomerPos]);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchOrders();
      fetchCompanies();
      fetchHostCompanies();
      fetchAllCustomerPos();
      fetchDrawings();
      if (parsedUser.department_code === 'ADMIN' || parsedUser.department_code === 'DESIGN_ENG' || parsedUser.department_code === 'SALES') {
        fetchBoms();
      }
    } else {
      fetchBoms();
      fetchDrawings();
    }

    // URL-based Navigation
    const path = window.location.pathname;
    if (path === '/sales/sales-order') {
      setViewMode('list');
    } else if (path.includes('/sales/sales-order/new-sales')) {
      handleAddOrder();
    }

    // Handle browser Back/Forward buttons
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      if (currentPath === '/sales/sales-order') {
        setViewMode('list');
      } else if (currentPath.includes('/sales/sales-order/new-sales')) {
        handleAddOrder();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location.pathname]);

  // Dynamic customer fields fetcher to avoid race condition on company load
  useEffect(() => {
    if (formData.customerId && companies.length > 0) {
      if (formMode === 'edit' || formMode === 'view') {
        return; // Skip auto-populating from company master for saved orders
      }
      if (formData.customerPoId && String(formData.customerPoId).startsWith('PO_')) {
        return; // Skip auto-populating from company master if a Customer PO is selected
      }
      const company = companies.find(c => String(c.id) === String(formData.customerId));
      if (company) {
        const primaryContact = company.contacts?.find(ct => ct.contact_type === 'PRIMARY') || company.contacts?.[0];
        const billing = company.addresses?.find(address => address.address_type === 'BILLING') || {};
        const shipping = company.addresses?.find(address => address.address_type === 'SHIPPING') || {};

        const billingAddressStr = [billing.line1, billing.line2, billing.city, billing.state, billing.pincode].filter(Boolean).join(', ');
        const shippingAddressStr = [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ');

        const nextEmail = primaryContact?.email || company.contact_email || '';
        const nextPhone = primaryContact?.phone || company.contact_mobile || '';
        const nextContactPerson = primaryContact?.name || company.contact_person || '';
        const nextType = company.customer_type || 'REGULAR';
        const nextGstin = company.gstin || '';
        const nextCity = billing.city || '';
        const nextState = billing.state || '';
        const nextBilling = billingAddressStr || '';
        const nextShipping = shippingAddressStr || '';

        // Prevent infinite loops by comparing current state values with next values
        if (
          formData.customerEmail !== nextEmail ||
          formData.customerPhone !== nextPhone ||
          formData.customerContactPerson !== nextContactPerson ||
          formData.customerType !== nextType ||
          formData.customerGstin !== nextGstin ||
          formData.customerCity !== nextCity ||
          formData.customerState !== nextState ||
          formData.customerBillingAddress !== nextBilling ||
          formData.customerShippingAddress !== nextShipping
        ) {
          setFormData(prev => ({
            ...prev,
            customerEmail: nextEmail,
            customerPhone: nextPhone,
            customerContactPerson: nextContactPerson,
            customerType: nextType,
            customerGstin: nextGstin,
            customerCity: nextCity,
            customerState: nextState,
            customerBillingAddress: nextBilling,
            customerShippingAddress: nextShipping
          }));
        }
      }
    }
  }, [companies, formData.customerId]);

  useEffect(() => {
    // Attempt to match customerPoId with uniqueKey from quotations if it's a simple ID
    if (formData.customerPoId && (formMode === 'edit' || formMode === 'view')) {
      const match = quotations.find(q => {
        if (q.uniqueKey === formData.customerPoId) return true;

        // If it's a numeric ID, try to match by dbId and sourceType
        const isNumeric = /^\d+$/.test(String(formData.customerPoId));
        if (isNumeric) {
          const id = Number(formData.customerPoId);
          if (q.dbId === id) {
            if (formData.sourceType === 'DRAWING') return q.isApprovedDrawing;
            if (formData.sourceType === 'QUOTATION') return !q.isApprovedDrawing && !q.isCustomerPo;
            if (formData.sourceType === 'DIRECT') return q.isCustomerPo;
          }
        }
        return false;
      });

      if (match && match.uniqueKey !== formData.customerPoId) {
        setFormData(prev => ({ ...prev, customerPoId: match.uniqueKey }));
      }
    }
  }, [quotations, formMode, formData.sourceType]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setOrders([]); // Clear stale data
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/order`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const mappedData = (Array.isArray(data) ? data : []).map(order => ({
          ...order,
          projectName: order.project_name // Map backend snake_case to camelCase used in initial implementation
        }));
        setOrders(mappedData);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
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
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchAllCustomerPos = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-pos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Store items from the API response (the list endpoint already includes items)
        const poOptions = (Array.isArray(data) ? data : []).map(po => ({
          id: po.id,
          dbId: po.id,
          uniqueKey: `PO_${po.id}`,
          company_id: po.company_id,
          created_at: po.created_at,
          status: po.status,
          po_number: po.po_number,
          company_name: po.company_name,
          host_company_id: po.host_company_id || po.hostCompanyId || null,
          isCustomerPo: true,
          items: Array.isArray(po.items) ? po.items : []
        }));
        setAllCustomerPos(poOptions);
      }
    } catch (err) {
      console.error('Error fetching all POs:', err);
    }
  };

  const fetchDrawings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllDrawings(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching drawings:', err);
    }
  };

  const handleDrawingChange = async (drawingId) => {
    if (!drawingId || isNaN(Number(drawingId))) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${drawingId}/autofetch-details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const details = await response.json();
        if (details.poId) {
          // Load the entire customer PO
          await handleCustomerPoChange(`PO_${details.poId}`);
          // Set the selected drawing values
          setFormData(prev => ({
            ...prev,
            drawingId: details.drawingId,
            drawingNo: details.drawingNo,
            finishedGoodName: details.finishedGoodName,
            designQty: details.designQty
          }));
        } else {
          const subTotalVal = (details.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
          const avgProfit = (details.items || []).reduce((sum, item) => sum + (Number(item.profit_percentage) || 0), 0) / (details.items.length || 1);
          const avgGst = (details.items || []).reduce((sum, item) => sum + (Number(item.cgst_percent || 0) + Number(item.sgst_percent || 0) + Number(item.igst_percent || 0)), 0) / (details.items.length || 1);
          const profitMarginVal = Number(avgProfit) || 0;
          const totalProfitVal = subTotalVal * (profitMarginVal / 100);
          const costWithProfit = subTotalVal + totalProfitVal;
          const gstAmount = costWithProfit * (avgGst / 100);
          const grandTotal = costWithProfit + gstAmount;

          setFormData(prev => ({
            ...prev,
            drawingId: details.drawingId,
            drawingNo: details.drawingNo,
            finishedGoodName: details.finishedGoodName,
            designQty: details.designQty,
            customerPoId: '',
            poNumber: '—',
            projectName: details.projectName || '—',
            customerId: details.companyId ? String(details.companyId) : '',
            clientName: details.clientName,
            customerContactPerson: details.contactPerson || '—',
            customerEmail: details.email || '—',
            customerPhone: details.phone || '—',
            customerType: details.customerType || 'REGULAR',
            customerGstin: details.gstin || '—',
            customerCity: details.city || '',
            customerState: details.state || '',
            customerBillingAddress: details.billingAddress || '—',
            customerShippingAddress: details.shippingAddress || '—',
            items: details.items || [],
            profitMargin: parseFloat(avgProfit.toFixed(2)) || 0,
            totalProfit: parseFloat(totalProfitVal.toFixed(2)) || 0,
            cgstRate: parseFloat((avgGst / 2).toFixed(2)) || 9,
            sgstRate: parseFloat((avgGst / 2).toFixed(2)) || 9,
            subtotal: parseFloat(costWithProfit.toFixed(2)) || 0,
            gst: parseFloat(gstAmount.toFixed(2)) || 0,
            grand_total: parseFloat(grandTotal.toFixed(2)) || 0,
            sourceType: 'DRAWING'
          }));
        }

        if (details.hostCompanyId) {
          setSelectedHostId(String(details.hostCompanyId));
        }
      } else {
        errorToast('Failed to fetch drawing details');
      }
    } catch (err) {
      console.error('Error fetching drawing details:', err);
      errorToast('Error fetching drawing details');
    } finally {
      setLoading(false);
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

        // ONLY set default selected host company if it hasn't been set yet (e.g. not in edit/view mode)
        if (!selectedHostId) {
          const active = data.find(c => c.status === 'ACTIVE');
          if (active) {
            setSelectedHostId(String(active.id));
            setSelectedHostCompany(active);
          } else if (data.length > 0) {
            setSelectedHostId(String(data[0].id));
            setSelectedHostCompany(data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching host companies:', err);
    }
  };

  const fetchApprovedQuotations = async (companyId) => {
    if (!companyId) return;
    try {
      const token = localStorage.getItem('authToken');
      const [quotesRes, approvedRes, customerPosRes] = await Promise.all([
        fetch(`${API_BASE}/quotation-requests?status=Approved,Approved ,COMPLETED,Completed,ACCEPTED,Accepted,Approval,APPROVAL&company_id=${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/order/approved-drawings?company_id=${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/customer-pos?company_id=${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      let allOptions = [];

      if (quotesRes.ok) {
        const data = await quotesRes.json();
        const companyQuotes = Array.isArray(data) ? data.filter(q => String(q.company_id) === String(companyId)) : [];

        const grouped = {};
        companyQuotes.forEach(quote => {
          const date = new Date(quote.created_at);
          const roundedTime = Math.floor(date.getTime() / 10000) * 10000;
          const key = `${quote.company_id}_${roundedTime}`;

          if (!grouped[key]) {
            grouped[key] = {
              id: quote.id || quote.qr_id,
              dbId: quote.id || quote.qr_id,
              uniqueKey: key,
              company_id: quote.company_id,
              company_name: quote.company_name,
              created_at: quote.created_at,
              status: quote.status,
              po_number: quote.po_number,
              host_company_id: quote.host_company_id || quote.hostCompanyId || null,
              items: []
            };
          }
          grouped[key].items.push(quote);
        });
        allOptions = Object.values(grouped);
      }

      if (customerPosRes.ok) {
        const data = await customerPosRes.json();
        const companyPos = Array.isArray(data) ? data : [];

        companyPos.forEach(po => {
          allOptions.push({
            id: po.id,
            dbId: po.id,
            uniqueKey: `PO_${po.id}`,
            company_id: po.company_id,
            po_date: po.po_date,
            created_at: po.created_at,
            status: po.status,
            po_number: po.po_number,
            company_name: po.company_name,
            host_company_id: po.host_company_id || po.hostCompanyId || null,
            isCustomerPo: true,
            items: (po.items || []).map(item => ({
              id: item.id,
              drawing_no: item.drawing_no,
              description: item.description,
              quantity: item.quantity,
              rate: item.rate
            }))
          });
        });
      }

      if (approvedRes.ok) {
        const data = await approvedRes.json();
        const companyApproved = Array.isArray(data) ? data.filter(o => String(o.company_id) === String(companyId)) : [];

        companyApproved.forEach(order => {
          const fgItems = (order.items || []).filter(item => item.item_group === 'FG');
          if (fgItems.length > 0) {
            const key = `Approved _${order.id}`;
            allOptions.push({
              id: order.id,
              dbId: order.id,
              uniqueKey: key,
              company_id: order.company_id,
              company_name: order.company_name,
              created_at: order.created_at,
              status: 'Approved _DRAWING',
              po_number: order.po_number,
              isApprovedDrawing: true,
              items: fgItems.map(item => ({
                id: item.id,
                drawing_no: item.drawing_no,
                item_description: item.description,
                item_qty: item.quantity,
                item_group: item.item_group,
                total_amount: (Number(item.bom_cost) || 0) * (Number(item.quantity) || 1)
              }))
            });
          }
        });
      }

      setQuotations(allOptions);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    }
  };

  const handleCustomerPoChange = async (uniqueKey) => {
    const group = quotations.find(q => q.uniqueKey === uniqueKey) || allCustomerPos.find(q => q.uniqueKey === uniqueKey);
    if (!group) return;

    let items = [];
    let avgProfit = 0;
    let avgGst = 18;
    let totalProfitVal = 0;
    let sourceType = 'QUOTATION';
    let quotationId = group.dbId;
    let bomId = null;
    let projectName = '';
    let finalHostId = null;
    let customerUpdateFields = {};
    let poNumber = group.po_number || '';

    if (group.isCustomerPo) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/customer-pos/${group.dbId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const poData = await response.json();
          sourceType = 'DIRECT';
          projectName = poData.project_name || `Order for ${poData.company_name}`;
          finalHostId = poData.host_company_id || null;
          poNumber = poData.po_number || group.po_number || '';

          if (poData.company_id) {
            const company = companies.find(c => String(c.id) === String(poData.company_id));
            const billing = company?.addresses?.find(address => address.address_type === 'BILLING') || {};

            customerUpdateFields.customerId = String(poData.company_id);
            customerUpdateFields.customerEmail = (poData.email && poData.email !== '—') ? poData.email : (poData.company_email || '');
            customerUpdateFields.customerPhone = (poData.phone && poData.phone !== '—') ? poData.phone : (poData.billing_contact_phone || poData.shipping_contact_phone || '');
            customerUpdateFields.customerContactPerson = (poData.contact_person && poData.contact_person !== '—') ? poData.contact_person : (poData.billing_contact_name || poData.shipping_contact_name || '');
            customerUpdateFields.customerBillingAddress = (poData.billing_address && poData.billing_address !== '—') ? poData.billing_address : '';
            customerUpdateFields.customerShippingAddress = (poData.shipping_address && poData.shipping_address !== '—') ? poData.shipping_address : '';
            customerUpdateFields.customerGstin = poData.gstin || '';
            customerUpdateFields.customerType = poData.customer_type || 'REGULAR';
            customerUpdateFields.customerCity = billing?.city || '';
            customerUpdateFields.customerState = billing?.state || '';
            fetchApprovedQuotations(poData.company_id);
          }

          const poItems = poData.items || [];
          items = poItems.map(item => {
            const qty = Number(item.quantity) || 1;
            const rate = Number(item.rate) || 0;
            const cgst = Number(item.cgst_percent) || 0;
            const sgst = Number(item.sgst_percent) || 0;
            const igst = Number(item.igst_percent) || 0;

            avgGst = cgst + sgst + igst;

            return {
              item_code: item.item_code || item.drawing_no || 'Standard',
              drawing_no: item.drawing_no,
              description: item.description,
              type: 'Standard',
              quantity: qty,
              rate: rate,
              amount: rate * qty,
              cgst_percent: cgst,
              sgst_percent: sgst,
              igst_percent: igst,
              hsn_code: item.hsn_code,
              delivery_date: item.delivery_date,
              sub_assemblies: (item.sub_assemblies || []).map(sa => ({
                ...sa,
                hsn_code: sa.hsn_code,
                delivery_date: sa.delivery_date
              }))
            };
          });
        }
      } catch (err) {
        console.error('Error fetching PO details:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // Filter out rejected items for calculation
      const activeItems = group.items.filter(item => item.status !== 'REJECTED');
      if (activeItems.length === 0) return;

      avgProfit = activeItems.reduce((sum, item) => sum + (Number(item.profit_percentage) || 0), 0) / activeItems.length;
      avgGst = activeItems.reduce((sum, item) => sum + (Number(item.gst_percentage) || 0), 0) / activeItems.length;
      sourceType = group.isApprovedDrawing ? 'DRAWING' : 'QUOTATION';
      bomId = group.items[0]?.bom_id;
      projectName = group.items[0]?.project_name;
      finalHostId = group.host_company_id || (group.items && group.items[0] && group.items[0].host_company_id) || null;

      items = group.items.map(item => {
        const qty = Number(item.item_qty) || 1;
        const totalAmount = Number(item.total_amount) || 0;
        const profitP = Number(item.profit_percentage) || avgProfit;

        const quotedPrice = qty > 0 ? totalAmount / qty : 0;
        const baseRate = quotedPrice / (1 + (profitP / 100));
        const itemProfit = (quotedPrice - baseRate) * qty;
        totalProfitVal += itemProfit;

        return {
          item_code: item.drawing_no || item.item_code || 'Standard',
          drawing_no: item.drawing_no,
          description: item.item_description || item.description,
          type: item.item_group || 'Standard',
          quantity: qty,
          rate: baseRate,
          amount: baseRate * qty,
          hsn_code: item.hsn_code,
          delivery_date: item.item_delivery || item.delivery_date,
          sub_assemblies: (item.sub_assemblies || []).map(sa => ({
            ...sa,
            drawingNo: sa.drawing_no || sa.component_code || sa.item_code || '',
            description: sa.description || `Sub-assembly`,
            quantity: parseFloat(sa.qty || sa.quantity || 0),
            unit: sa.uom || sa.unit || 'NOS',
            rate: parseFloat(sa.rate || sa.bom_cost || 0).toFixed(2),
            item_group: sa.item_group || 'SA',
            hsn_code: sa.hsn_code,
            delivery_date: sa.delivery_date
          }))
        };
      });
    }

    setFormData(prev => ({
      ...prev,
      customerPoId: uniqueKey,
      poNumber: poNumber || '',
      items,
      profitMargin: parseFloat(avgProfit.toFixed(2)),
      totalProfit: parseFloat(totalProfitVal.toFixed(2)),
      cgstRate: parseFloat((avgGst / 2).toFixed(2)),
      sgstRate: parseFloat((avgGst / 2).toFixed(2)),
      sourceType,
      quotation_id: sourceType !== 'DIRECT' ? quotationId : null,
      customer_po_id: sourceType === 'DIRECT' ? quotationId : null,
      bomId: bomId || prev.bomId,
      projectName: projectName || prev.projectName,
      ...customerUpdateFields
    }));

    // Pre-select host company from quotation/PO if saved, or fall back to default active company
    const hostId = finalHostId || null;
    if (hostId) {
      setSelectedHostId(String(hostId));
      const matchedHost = hostCompanies.find(h => String(h.id) === String(hostId));
      setSelectedHostCompany(matchedHost || null);
    } else {
      const active = hostCompanies.find(c => c.status === 'ACTIVE');
      if (active) {
        setSelectedHostId(String(active.id));
        setSelectedHostCompany(active);
      } else if (hostCompanies.length > 0) {
        setSelectedHostId(String(hostCompanies[0].id));
        setSelectedHostCompany(hostCompanies[0]);
      }
    }
  };

  const fetchBoms = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBoms(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching boms:', err);
    }
  };

  const handleAddOrder = () => {
    setFormData(initialFormState);
    setFormMode('create');
    setViewMode('form');

    // Reset host company to globally active company
    const active = hostCompanies.find(c => c.status === 'ACTIVE');
    if (active) {
      setSelectedHostId(String(active.id));
      setSelectedHostCompany(active);
    } else if (hostCompanies.length > 0) {
      setSelectedHostId(String(hostCompanies[0].id));
      setSelectedHostCompany(hostCompanies[0]);
    } else {
      setSelectedHostId('');
      setSelectedHostCompany(null);
    }

    // Update URL behavior
    if (window.location.pathname !== '/sales/sales-order/new-sales') {
      window.history.pushState({}, '', '/sales/sales-order/new-sales');
    }
  };

  const handleCreateShipment = async (order) => {
    try {
      const result = await Swal.fire({
        title: 'Create Shipment Order?',
        text: `Do you want to create a shipment order for ${order.order_no || `ORD-${String(order.id).padStart(4, '0')}`}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Create',
        cancelButtonText: 'No, Cancel'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/shipments/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ salesOrderId: order.id })
        });

        if (response.ok) {
          successToast('Shipment order created successfully');
          fetchOrders();
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create shipment order');
        }
      }
    } catch (err) {
      console.error('Error creating shipment:', err);
      errorToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = async (order) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/order/${order.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();

        // Prepare items with calculated amount if missing
        const formattedItems = (data.items || []).map(item => {
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          return {
            ...item,
            quantity: qty,
            rate: rate,
            amount: Number(item.amount) || (qty * rate)
          };
        });

        let mappedPoId = data.customer_po_id || data.quotation_id || '';
        if (data.source_type === 'DRAWING' && data.quotation_id) {
          mappedPoId = `Approved _${data.quotation_id}`;
        } else if (data.source_type === 'DIRECT' && data.customer_po_id) {
          mappedPoId = `PO_${data.customer_po_id}`;
        }

        const subtotalInclusiveOfProfit = Number(data.subtotal) || 0;
        const baseItemsSubtotal = formattedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const totalProfitVal = subtotalInclusiveOfProfit - baseItemsSubtotal;

        let customerUpdateFields = {};
        if (data.source_type === 'DIRECT' && data.customer_po_id) {
          try {
            const poResponse = await fetch(`${API_BASE}/customer-pos/${data.customer_po_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (poResponse.ok) {
              const poData = await poResponse.json();
              const company = companies.find(c => String(c.id) === String(poData.company_id));
              const billing = company?.addresses?.find(address => address.address_type === 'BILLING') || {};

              customerUpdateFields.customerEmail = (poData.email && poData.email !== '—') ? poData.email : (poData.company_email || '');
              customerUpdateFields.customerPhone = (poData.phone && poData.phone !== '—') ? poData.phone : (poData.billing_contact_phone || poData.shipping_contact_phone || '');
              customerUpdateFields.customerContactPerson = (poData.contact_person && poData.contact_person !== '—') ? poData.contact_person : (poData.billing_contact_name || poData.shipping_contact_name || '');
              customerUpdateFields.customerBillingAddress = (poData.billing_address && poData.billing_address !== '—') ? poData.billing_address : '';
              customerUpdateFields.customerShippingAddress = (poData.shipping_address && poData.shipping_address !== '—') ? poData.shipping_address : '';
              customerUpdateFields.customerGstin = poData.gstin || '';
              customerUpdateFields.customerType = poData.customer_type || 'REGULAR';
              customerUpdateFields.customerCity = billing?.city || '';
              customerUpdateFields.customerState = billing?.state || '';
            }
          } catch (poErr) {
            console.error('Error fetching PO details during edit:', poErr);
          }
        }

        if (!customerUpdateFields.customerEmail) {
          customerUpdateFields.customerEmail = data.contact_email || data.email_address || '';
          customerUpdateFields.customerPhone = data.contact_mobile || data.contact_phone || '';
          customerUpdateFields.customerContactPerson = data.contact_person || '';
          customerUpdateFields.customerBillingAddress = data.billing_address || '';
          customerUpdateFields.customerShippingAddress = data.shipping_address || '';

          const company = companies.find(c => String(c.id) === String(data.client_id || data.company_id));
          const billing = company?.addresses?.find(address => address.address_type === 'BILLING') || {};
          customerUpdateFields.customerGstin = company?.gstin || '';
          customerUpdateFields.customerType = company?.customer_type || 'REGULAR';
          customerUpdateFields.customerCity = billing?.city || '';
          customerUpdateFields.customerState = billing?.state || '';
        }

        setFormData({
          ...initialFormState,
          id: data.id,
          series: data.order_no || `ORD-${String(data.id).padStart(4, '0')}`,
          orderDate: data.order_date?.split('T')[0] || data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          deliveryDate: data.delivery_date ? data.delivery_date.split('T')[0] : (data.target_dispatch_date ? data.target_dispatch_date.split('T')[0] : ''),
          orderType: 'Sales',
          projectName: data.project_name || '',
          customerId: data.client_id || data.company_id || '',
          customerEmail: data.contact_email || data.email_address || '',
          customerPhone: data.contact_mobile || data.contact_phone || '',
          customerPoId: mappedPoId,
          sourceType: data.source_type || 'DIRECT',
          orderQuantity: formattedItems?.[0]?.quantity || 1,
          warehouse: data.warehouse || '',
          status: data.status || 'Draft',
          cgstRate: Number(data.cgst_rate) || 0,
          sgstRate: Number(data.sgst_rate) || 0,
          profitMargin: Number(data.profit_margin) || 0,
          totalProfit: totalProfitVal,
          subtotal: subtotalInclusiveOfProfit,
          gst: Number(data.gst) || 0,
          grand_total: Number(data.grand_total) || 0,
          items: formattedItems,
          ...customerUpdateFields
        });

        if (data.host_company_id) {
          setSelectedHostId(String(data.host_company_id));
          const matchedHost = hostCompanies.find(h => String(h.id) === String(data.host_company_id));
          setSelectedHostCompany(matchedHost || null);
        } else {
          const active = hostCompanies.find(c => c.status === 'ACTIVE');
          if (active) {
            setSelectedHostId(String(active.id));
            setSelectedHostCompany(active);
          } else if (hostCompanies.length > 0) {
            setSelectedHostId(String(hostCompanies[0].id));
            setSelectedHostCompany(hostCompanies[0]);
          }
        }

        setFormMode('edit');
        setViewMode('form');
        window.history.pushState({}, '', '/sales/sales-order/edit-order');

        // Async Background fetch for PO details & quotations without blocking the render
        const companyId = data.client_id || data.company_id;
        if (companyId) {
          fetchApprovedQuotations(companyId).catch(() => null);
        }

        if (data.source_type === 'DIRECT' && data.customer_po_id) {
          (async () => {
            try {
              setExtraLoading(true);
              const poResponse = await fetch(`${API_BASE}/customer-pos/${data.customer_po_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (poResponse.ok) {
                const poData = await poResponse.json();
                const company = companies.find(c => String(c.id) === String(poData.company_id));
                const billing = company?.addresses?.find(address => address.address_type === 'BILLING') || {};
                setFormData(prev => ({
                  ...prev,
                  customerEmail: (poData.email && poData.email !== '—') ? poData.email : (poData.company_email || prev.customerEmail || ''),
                  customerPhone: (poData.phone && poData.phone !== '—') ? poData.phone : (poData.billing_contact_phone || poData.shipping_contact_phone || prev.customerPhone || ''),
                  customerContactPerson: (poData.contact_person && poData.contact_person !== '—') ? poData.contact_person : (poData.billing_contact_name || poData.shipping_contact_name || prev.customerContactPerson || ''),
                  customerBillingAddress: (poData.billing_address && poData.billing_address !== '—') ? poData.billing_address : prev.customerBillingAddress || '',
                  customerShippingAddress: (poData.shipping_address && poData.shipping_address !== '—') ? poData.shipping_address : prev.customerShippingAddress || '',
                  customerGstin: poData.gstin || prev.customerGstin || '',
                  customerType: poData.customer_type || prev.customerType || 'REGULAR',
                  customerCity: billing?.city || prev.customerCity || '',
                  customerState: billing?.state || prev.customerState || ''
                }));
              }
            } catch (err) {
              console.error('Error fetching background PO details:', err);
            } finally {
              setExtraLoading(false);
            }
          })();
        }
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      errorToast('Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (order) => {
    await handleEditOrder(order);
    setFormMode('view');

    // Update URL behavior
    window.history.pushState({}, '', '/sales/sales-order/view-order');
  };

  const handleDeleteOrder = async (id) => {
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
        const response = await fetch(`${API_BASE}/order/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          successToast('Order has been deleted');
          fetchOrders();
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to delete order');
        }
      } catch (err) {
        errorToast(err.message);
      }
    }
  };

  const handleViewPoPdf = async () => {
    const selectedPo = quotations.find(q => q.uniqueKey === formData.customerPoId);
    if (!selectedPo || !selectedPo.isCustomerPo) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-pos/${selectedPo.dbId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
      // Note: We don't revokeObjectURL immediately so the new tab can load it
    } catch (err) {
      console.error('Error downloading PDF:', err);
      errorToast('Failed to download PO PDF');
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/order/${orderId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error downloading invoice:', err);
      errorToast('Failed to download invoice');
    }
  };

  const handleSaveOrder = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const method = formMode === 'create' ? 'POST' : 'PUT';
      const url = formMode === 'create' ? `${API_BASE}/order` : `${API_BASE}/order/${formData.id}`;

      // Calculate totals for the new schema
      const subTotalVal = (formData.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const profitMarginVal = Number(formData.profitMargin) || 0;
      const totalProfitVal = Number(formData.totalProfit) || (subTotalVal * (profitMarginVal / 100));
      const costWithProfit = subTotalVal + totalProfitVal;
      const cgstRateVal = Number(formData.cgstRate) || 0;
      const sgstRateVal = Number(formData.sgstRate) || 0;
      const gstAmount = costWithProfit * ((cgstRateVal + sgstRateVal) / 100);
      const grandTotal = costWithProfit + gstAmount;

      // Extract numeric IDs from the uniqueKey
      const selectedPo = quotations.find(q => q.uniqueKey === formData.customerPoId);

      let quotationId = null;

      if (selectedPo) {
        quotationId = selectedPo.dbId;
      } else if (formData.customerPoId) {
        quotationId = formData.customerPoId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: formData.customerId,
          quotation_id: quotationId,
          project_name: formData.projectName,
          order_date: formData.orderDate,
          delivery_date: formData.deliveryDate || null,
          status: formData.status,
          source_type: formData.sourceType || 'DIRECT',
          warehouse: formData.warehouse,
          cgst_rate: cgstRateVal,
          sgst_rate: sgstRateVal,
          profit_margin: profitMarginVal,
          subtotal: costWithProfit,
          gst: gstAmount,
          grand_total: grandTotal,
          items: formData.items,
          host_company_id: selectedHostId || null
        })
      });

      if (response.ok) {
        successToast(`Order ${formMode === 'create' ? 'created' : 'updated'} successfully`);
        setViewMode('list');
        if (window.location.pathname !== '/sales/sales-order') {
          window.history.pushState({}, '', '/sales/sales-order');
        }
        fetchOrders();
      } else {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to save order');
      }
    } catch (err) {
      errorToast(err.message);
    }
  };

  const handleBomChange = async (bomId) => {
    if (!bomId) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/items/${bomId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const bomDetails = await response.json();
        const selectedBom = boms.find(b => String(b.id) === String(bomId));

        // Use saved bom_cost if available, otherwise calculate it
        let totalRate = Number(selectedBom?.bom_cost || 0);

        if (totalRate === 0) {
          if (bomDetails.materials) {
            totalRate += bomDetails.materials.reduce((sum, m) => sum + (Number(m.qty_per_pc || 0) * Number(m.rate || 0)), 0);
          }
          if (bomDetails.components) {
            totalRate += bomDetails.components.reduce((sum, c) => sum + (Number(c.quantity || 0) * Number(c.rate || 0)), 0);
          }
          if (bomDetails.operations) {
            totalRate += bomDetails.operations.reduce((sum, o) => sum + (Number(o.hourly_rate || 0) * (Number(o.cycle_time_min || 0) / 60)), 0);
          }

          // Subtract scrap value if present in calculation
          if (bomDetails.scrap) {
            const scrapValue = bomDetails.scrap.reduce((sum, s) => {
              const input = Number(s.input_qty || 0);
              const loss = Number(s.loss_percent || 0) / 100;
              const rate = Number(s.rate || 0);
              return sum + (input * loss * rate);
            }, 0);
            totalRate -= scrapValue;
          }
        }

        const items = [{
          item_code: selectedBom?.item_code || '',
          description: selectedBom?.description || '',
          type: 'Finished Good',
          quantity: formData.orderQuantity,
          rate: totalRate || 0,
          amount: (totalRate || 0) * formData.orderQuantity
        }];

        setFormData(prev => ({
          ...prev,
          bomId,
          items
        }));
      }
    } catch (err) {
      console.error('Error fetching BOM details:', err);
    }
  };

  const columns = [
    {
      label: 'Order Details',
      key: 'order_no',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className=" text-indigo-600 ">
            {val || `ORD-${String(row.id).padStart(4, '0')}`}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 ">
              {row.order_type || 'Sales Order'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Client Name',
      key: 'client',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shadow-sm">
            {val ? val.substring(0, 2).toUpperCase() : 'C'}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 leading-tight">{val || '—'}</span>
            {row.total_items_count > 0 && (
              <span className="text-[10px] mt-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100 w-fit">
                {row.approved_items_count} / {row.total_items_count} Approved
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      label: 'Project Name',
      key: 'project_name',
      sortable: true,
      render: (val, row) => (
        <span className="text-xs text-slate-600 font-medium italic" title={row.project_name}>
          {cleanProjectName(row.project_name, 'General Project')}
        </span>
      )
    },
    {
      label: 'Order Date',
      key: 'order_date',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs">{new Date(val || row.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      )
    },
    {
      label: 'Delivery',
      key: 'delivery_date',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-2">
          {val ? (
            <>
              <div className={`w-2 h-2 rounded ${new Date(val) < new Date() ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-xs text-slate-600 ">
                {new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </div>
      )
    },
    {
      label: 'Grand Total',
      key: 'grand_total',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-1  text-slate-900">
            <span className="text-indigo-600 ">₹</span>
            <span>{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
            <Check className="w-3 h-3" /> Inclusive of Tax
          </span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <div className="flex items-center justify-center">
          <StatusBadge status={val} />
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => {
        const isReadyForShipment = ['READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED'].includes(row.status?.toUpperCase());
        return (
          <div className="flex justify-end items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {isReadyForShipment && (
              <button
                onClick={() => navigate('/accounts/payment-received')}
                className="p-2 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
                title="Account / Payment"
              >
                <User className="w-4 h-4 group-hover:scale-110" />
              </button>
            )}
            <div className="h-4 w-[1px] bg-slate-100 mx-0.5" />
            <button
              onClick={() => handleViewOrder(row)}
              className="p-2 hover:bg-indigo-50 rounded  text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 group shadow-sm"
              title="View Details"
            >
              <Eye className="w-4 h-4 group-hover:scale-110" />
            </button>
            <button
              onClick={() => handleDownloadInvoice(row.id)}
              className="p-2 hover:bg-emerald-50 rounded  text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 group shadow-sm"
              title="Download Invoice"
            >
              <Download className="w-4 h-4 group-hover:scale-110" />
            </button>
            <button
              onClick={() => handleEditOrder(row)}
              className="p-2 hover:bg-amber-50 rounded  text-slate-400 hover:text-amber-600 transition-all border border-transparent hover:border-amber-100 group shadow-sm"
              title="Edit Order"
            >
              <Pencil className="w-4 h-4 group-hover:scale-110" />
            </button>
            <button
              onClick={() => handleDeleteOrder(row.id)}
              className="p-2 hover:bg-rose-50 rounded  text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
              title="Delete Order"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110" />
            </button>
          </div>
        );
      }
    }
  ];

  const viewOrderColumns = useMemo(() => [
    {
      label: 'Item Code',
      key: 'item_code',
      render: (val, item) => (
        <div className="py-1">
          <span className="font-mono font-bold text-indigo-600 block">
            {item.drawing_no || item.item_code || val}
          </span>
          {item.description && (
            <span className="text-[11px] text-slate-400 font-sans block mt-0.5 leading-tight max-w-[300px] truncate" title={item.description}>
              {item.description}
            </span>
          )}
        </div>
      )
    },
    {
      label: 'Type',
      key: 'type',
      render: (val) => <span className="text-slate-600 text-xs font-medium">{val || 'Standard'}</span>
    },
    {
      label: 'HSN Code',
      key: 'hsn_code',
      render: (val) => <span className="text-slate-500 text-xs font-mono">{val || '—'}</span>
    },
    {
      label: 'Item Delivery',
      key: 'delivery_date',
      render: (val) => (
        <span className="text-slate-600 text-xs font-medium">
          {val ? new Date(val).toLocaleDateString('en-GB') : '—'}
        </span>
      )
    },
    {
      label: 'Qty',
      key: 'quantity',
      className: 'text-center',
      render: (val) => <span className="text-slate-900 font-bold text-xs">{val || 0}</span>
    },
    {
      label: 'Rate',
      key: 'rate',
      className: 'text-right',
      render: (val) => <span className="text-slate-600 text-xs font-mono">₹ {(Number(val) || 0).toFixed(2)}</span>
    },
    {
      label: 'Amount',
      key: 'amount',
      className: 'text-right',
      render: (val) => <span className="text-emerald-600 font-bold text-xs font-mono">₹ {(Number(val) || 0).toFixed(2)}</span>
    }
  ], []);

  if (viewMode === 'list') {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => ['DRAFT', 'CREATED', 'IN_PROGRESS'].includes(o.status?.toUpperCase())).length;
    const completedOrders = orders.filter(o => ['COMPLETED', 'FULFILLED', 'DELIVERED'].includes(o.status?.toUpperCase())).length;

    const filteredOrders = orders.filter(order => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      
      const soNumber = (order.order_no || `ORD-${String(order.id).padStart(4, '0')}`).toLowerCase();
      const clientName = (order.client || order.company_name || '').toLowerCase();
      const projectName = (order.project_name || order.projectName || '').toLowerCase();
      
      const itemsMatch = (order.items || []).some(item => {
        const drawingNo = (item.drawing_no || '').toLowerCase();
        const drawingName = (item.description || item.drawing_name || '').toLowerCase();
        return drawingNo.includes(q) || drawingName.includes(q);
      });
      
      return soNumber.includes(q) || clientName.includes(q) || projectName.includes(q) || itemsMatch;
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-xl   text-slate-900 ">Sales Orders</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs  text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded bg-slate-400" />
                  {totalOrders} Total
                </span>
                <span className="text-xs  text-amber-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded bg-amber-500 animate-pulse" />
                  {pendingOrders} Processing
                </span>
                <span className="text-xs  text-emerald-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded bg-emerald-500" />
                  {completedOrders} Finalized
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={fetchOrders}
              icon={RefreshCw}
              className={loading ? 'animate-spin' : ''}
              title="Refresh Data"
            />
            <Button
              variant="primary"
              onClick={handleAddOrder}
              icon={Plus}
            >
              Create New Order
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 border border-slate-200 rounded-xl shadow-sm my-4">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by SO #, customer, project, drawing # or drawing name..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900 transition-all font-medium placeholder-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className=" overflow-hidden my-4">
          <DataTable
            columns={columns}
            data={filteredOrders}
            loading={loading}
            searchPlaceholder="Search orders by number, customer or project..."
            className="border-none"
            hideSearch={true}
          />
        </div>
      </div>
    );
  }

  // Form View
  const selectedBom = boms.find(b => String(b.id) === String(formData.bomId));
  const subTotal = (formData.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const profitMarginVal = Number(formData.profitMargin) || 0;
  // Use totalProfit if available, otherwise calculate from percentage
  const totalProfitVal = Number(formData.totalProfit) || (subTotal * (profitMarginVal / 100));
  const costWithProfit = subTotal + totalProfitVal;
  const cgstRateVal = Number(formData.cgstRate) || 0;
  const sgstRateVal = Number(formData.sgstRate) || 0;
  const gstAmount = costWithProfit * ((cgstRateVal + sgstRateVal) / 100);
  const totalAmount = costWithProfit + gstAmount;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => {
              setViewMode('list');
              if (window.location.pathname !== '/sales/sales-order') {
                window.history.pushState({}, '', '/sales/sales-order');
              }
            }}
            icon={ArrowLeft}
          />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-rose-600 rounded">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl  text-slate-900 leading-tight">
                {formMode === 'create' ? 'New Sales Order' : formMode === 'edit' ? 'Edit Sales Order' : 'View Sales Order'}
              </h1>
              <p className="text-xs text-slate-500 ">Create and configure sales orders</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setViewMode('list');
              if (window.location.pathname !== '/sales/sales-order') {
                window.history.pushState({}, '', '/sales/sales-order');
              }
            }}
          >
            Cancel
          </Button>
          {formMode !== 'view' && (
            <Button
              variant="primary"
              onClick={handleSaveOrder}
              icon={Save}
              disabled={loading}
            >
              {loading ? 'Saving...' : (formMode === 'create' ? 'Save Sales Order' : 'Update Sales Order')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <div className="lg:col-span-7 space-y-4">
          {/* Host Company Profile Details */}
          <Card title="Host Billing Entity Details" className="bg-white border border-slate-200 rounded-xl" subtitle="Select issuing host company profile for this sales document">
            <div className="p-3 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-100 pb-3">
                <div className="w-full md:max-w-md">
                  <FormControl label="Select Issuing Billing Profile *">
                    <select
                      className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-white text-slate-900 font-medium"
                      value={selectedHostId}
                      onChange={(e) => {
                        const host = hostCompanies.find(h => String(h.id) === String(e.target.value));
                        setSelectedHostId(e.target.value);
                        setSelectedHostCompany(host || null);
                      }}
                      disabled={formMode === 'view'}
                    >
                      <option value="">Select billing profile...</option>
                      {hostCompanies.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                </div>
                {selectedHostCompany && selectedHostCompany.status !== 'ACTIVE' && formMode !== 'view' && (
                  <Button
                    variant="light"
                    size="sm"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={async () => {
                      const confirm = await Swal.fire({
                        title: 'Set as Active Host Company?',
                        text: `Do you want to make "${selectedHostCompany.company_name}" the active host company globally?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, Set Active'
                      });
                      if (confirm.isConfirmed) {
                        try {
                          const token = localStorage.getItem('authToken');
                          const response = await fetch(`${API_BASE}/admin-company-master/${selectedHostCompany.id}`, {
                            method: 'PUT',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ status: 'ACTIVE' })
                          });
                          if (response.ok) {
                            successToast('Billing profile activated globally');
                            fetchHostCompanies();
                          } else {
                            throw new Error('Failed to activate profile');
                          }
                        } catch (err) {
                          errorToast(err.message);
                        }
                      }
                    }}
                  >
                    Activate Globally
                  </Button>
                )}
              </div>

              {selectedHostCompany ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    {selectedHostCompany.company_logo ? (
                      <img
                        src={getFileUrl(selectedHostCompany.company_logo)}
                        alt="Logo"
                        className="h-16 max-w-full object-contain mb-2 bg-white border border-slate-200 p-1.5 rounded shadow-sm"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-lg mb-2">
                        {selectedHostCompany.company_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800 leading-tight truncate w-full">{selectedHostCompany.company_name}</span>
                    <span className={`text-[9px] mt-1.5 px-2 py-0.5 rounded-full font-semibold border ${selectedHostCompany.status === 'ACTIVE'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                      : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                      {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                    </span>
                  </div>

                  <div className="space-y-2 p-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Office Details</p>
                    <div className="space-y-1 text-slate-600 text-xs">
                      <div className="flex gap-1.5 items-start">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{selectedHostCompany.company_address || '—'}</span>
                      </div>
                      <div className="pt-1 flex flex-col gap-1">
                        <p className="font-mono text-[10px]">GSTIN: <span className="font-bold text-slate-700">{selectedHostCompany.gstin || '—'}</span></p>
                        <p className="font-mono text-[10px]">PAN: <span className="font-bold text-slate-700">{selectedHostCompany.pan || '—'}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Credentials</p>
                    <div className="space-y-1.5 text-slate-600 text-xs font-mono">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-sans">Bank Name</p>
                        <p className="font-bold text-slate-700 font-sans text-xs truncate">{selectedHostCompany.bank_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-sans">Account & IFSC</p>
                        <p className="font-semibold text-slate-800 text-xs">{selectedHostCompany.account_number || '—'}</p>
                        {selectedHostCompany.ifsc_code && (
                          <p className="text-[10px] text-slate-400">IFSC: {selectedHostCompany.ifsc_code.toUpperCase()}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  Select a host company profile above to preview its billing and banking credentials
                </div>
              )}
            </div>
          </Card>

          {/* Order Information */}
          <Card title="Order Information" className='bg-white' subtitle="Basic details about the order">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-2">
              <FormControl label="Series">
                <input
                  className="w-full p-2 border border-slate-200 rounded  text-xs bg-slate-50 text-slate-500"
                  value={formData.series}
                  disabled
                />
              </FormControl>
              <FormControl label="Order Date *">
                <input
                  type="date"
                  className="w-full p-2 border border-slate-200 rounded  text-xs"
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Delivery Date">
                <input
                  type="date"
                  className="w-full p-2 border border-slate-200 rounded  text-xs"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Order Type">
                <select
                  className="w-full p-2 border border-slate-200 rounded  text-xs"
                  value={formData.orderType}
                  onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                  disabled={formMode === 'view'}
                >
                  <option value="Sales">Sales</option>
                  <option value="Internal">Internal</option>
                </select>
              </FormControl>
            </div>
          </Card>

          {/* Customer Details */}
          <Card title="Customer Details" className='bg-white border border-slate-200 rounded-xl' subtitle="Customer contact information">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-2">
              {/* Select Drawing — restored as original */}
              <FormControl label="Select Drawing *">
                <SearchableSelect
                  options={allDrawings.map(d => ({
                    value: d.drawing_master_id || d.id,
                    label: `${d.drawing_no} - ${d.drawing_description || d.description || 'No Description'}`
                  }))}
                  value={formData.drawingId}
                  onChange={(e) => handleDrawingChange(e.target.value)}
                  placeholder="Select Drawing..."
                  disabled={formMode === 'view'}
                  allowCustom={false}
                />
              </FormControl>

              {/* Customer PO — now a dropdown showing all POs separately */}
              <FormControl label="Customer PO">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      options={memoizedPoOptions}
                      value={formData.customerPoId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        handleCustomerPoChange(val);
                      }}
                      placeholder="Select PO..."
                      disabled={formMode === 'view'}
                      allowCustom={false}
                    />
                  </div>
                  {formData.customerPoId && String(formData.customerPoId).startsWith('PO_') && (
                    <button
                      type="button"
                      className="p-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors border border-indigo-100"
                      title="View PO PDF"
                      onClick={handleViewPoPdf}
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </FormControl>

              <FormControl label="Project No.">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.projectName || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="Customer">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={companies.find(c => String(c.id) === String(formData.customerId))?.company_name || formData.clientName || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="Contact Person">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerContactPerson || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="Phone">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerPhone || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="Email">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerEmail || ''}
                  disabled
                />
              </FormControl>


              <FormControl label="Design Qty">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.designQty ? `${formData.designQty} Nos` : ''}
                  disabled
                />
              </FormControl>

              <FormControl label="Type">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerType || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="GSTIN">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerGstin || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="City">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerCity || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="State">
                <input
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500"
                  value={formData.customerState || ''}
                  disabled
                />
              </FormControl>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
              <FormControl label="Billing Address">
                <textarea
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500 min-h-[50px]"
                  value={formData.customerBillingAddress || ''}
                  disabled
                />
              </FormControl>

              <FormControl label="Shipping Address">
                <textarea
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-500 min-h-[50px]"
                  value={formData.customerShippingAddress || ''}
                  disabled
                />
              </FormControl>
            </div>
          </Card>

          {/* Project and storage details */}
          <Card title="Project & Inventory" className='bg-white' subtitle="Project and storage details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
              <FormControl label="Project Name">
                <input
                  className="w-full p-2 border border-slate-200 rounded  text-xs"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="Project name..."
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Warehouse">
                <select
                  className="w-full p-2 border border-slate-200 rounded  text-xs"
                  value={formData.warehouse}
                  onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                  disabled={formMode === 'view'}
                >
                  <option value="">Select warehouse...</option>
                  {warehouseOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormControl>
            </div>
          </Card>

          {/* Items included in selected PO */}
          {formData.items.length > 0 && (
            <Card title="Items included in selected PO" className='bg-white' subtitle="Order Items">
              <div className="p-2 bg-blue-50/50 rounded  mb-4 border border-blue-100 flex items-center gap-2">
                <div className="p-2 bg-white rounded   border border-blue-100">
                  <Package className="w-3 h-3 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs  text-slate-900">Items <span className="text-slate-400 font-normal ml-1">({formData.items.length})</span></p>
                  <p className="text-xs text-indigo-600  ">PO Number: {formData.customerPoId ? (String(formData.customerPoId).includes('_') ? formData.customerPoId.split('_')[1] : formData.customerPoId) : 'N/A'}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs max-h-[45vh] min-h-[220px] relative">
                <DataTable
                  columns={viewOrderColumns}
                  data={formData.items}
                  pageSize={100}
                  hideSearch={true}
                  emptyMessage="No items found in this order."
                  expandable={formData.items.some(i => i.sub_assemblies && i.sub_assemblies.length > 0)}
                  renderExpanded={(item) => {
                    if (!item.sub_assemblies || item.sub_assemblies.length === 0) return null;
                    const parentQty = parseFloat(item.quantity) || 1;
                    return (
                      <div className="bg-slate-50/70 p-3 space-y-2 border-t border-b border-slate-100/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sub Assemblies & Parts</p>
                        <div className="space-y-1.5">
                          {item.sub_assemblies.map((sa, saIdx) => {
                            const saQty = (parseFloat(sa.quantity || 0) * parentQty);
                            const saRate = parseFloat(sa.rate || 0);
                            const saTotal = saQty * saRate;
                            const saGroup = (sa.item_group || '').toUpperCase();
                            const isSaPart = saGroup.includes('PART');
                            return (
                              <div key={saIdx} className="flex items-center justify-between text-xs p-2 bg-white rounded border border-slate-200/80 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <GitBranch size={12} className="text-blue-500 rotate-180" />
                                  <span className="font-mono text-slate-600 font-bold text-[11px]">{sa.drawingNo || sa.drawing_no}</span>
                                  <span className="text-slate-800 font-semibold">{sa.description}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSaPart ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    {isSaPart ? 'PART' : 'ASM'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium">
                                  <span className="text-slate-600">Qty: <strong className="text-slate-900">{saQty.toFixed(3)}</strong></span>
                                  <span className="text-slate-600">Rate: <strong className="text-slate-900">₹ {saRate.toFixed(2)}</strong></span>
                                  <span className="text-indigo-600 font-bold">Total: ₹ {saTotal.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-6 self-start">
          {/* Order Summary & Controls Card */}
          <Card title="Order Summary & Controls" className='bg-white shadow-sm border border-slate-100 rounded-xl overflow-hidden'>
            <div className="p-3 space-y-5">
              {/* Status and Taxes Section */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status & Taxes</h3>
                <FormControl label="Status">
                  <select
                    className="w-full p-2 border border-slate-200 rounded text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    disabled={formMode === 'view'}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Created">Created</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </FormControl>
                
                <div className="grid grid-cols-2 gap-2">
                  <FormControl label="CGST Rate (%)">
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-200 rounded text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                      value={formData.cgstRate}
                      onChange={(e) => setFormData({ ...formData, cgstRate: Number(e.target.value) })}
                      disabled={formMode === 'view'}
                    />
                  </FormControl>
                  <FormControl label="SGST Rate (%)">
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-200 rounded text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                      value={formData.sgstRate}
                      onChange={(e) => setFormData({ ...formData, sgstRate: Number(e.target.value) })}
                      disabled={formMode === 'view'}
                    />
                  </FormControl>
                </div>
              </div>

              {/* Price Breakdown Section */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Breakdown</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Items Subtotal:</span>
                    <span className="text-slate-900 font-semibold">₹ {(Number(subTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-blue-600">
                    <span>Total Profit:</span>
                    <span className="font-semibold">₹ {(Number(totalProfitVal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Tax (GST {cgstRateVal + sgstRateVal}%):</span>
                    <span className="text-slate-900 font-semibold">₹ {(Number(gstAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="pt-3 mt-1 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Value</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">₹ {(Number(totalAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-slate-200">
        <button
          onClick={() => setViewMode('list')}
          className="p-2 bg-emerald-600 text-white rounded text-xs  hover:bg-emerald-700 transition-colors  flex items-center gap-2 "
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {formMode !== 'view' && (
          <button
            onClick={handleSaveOrder}
            className="p-2 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-colors  shadow-lg text-xs text-xs flex items-center gap-2 "
          >
            <Save className="w-4 h-4" />
            Save Sales Order
          </button>
        )}
      </div>

      <DrawingPreviewModal
        isOpen={!!previewDrawing}
        onClose={() => setPreviewDrawing(null)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default SalesOrders;

