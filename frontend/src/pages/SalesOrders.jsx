import React, { useState, useEffect } from 'react';
import { Card, DataTable, FormControl, StatusBadge, Badge, SearchableSelect } from '../components/ui.jsx';
import { Truck } from 'lucide-react';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Plus, 
  Package, 
  ChevronRight, 
  ArrowLeft, 
  Save, 
  Loader2,
  FileText,
  Calendar,
  DollarSign,
  Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const warehouseOptions = [
  { value: 'RM', label: 'Raw Material Warehouse' },
  { value: 'WIP', label: 'Production Issue (WIP)' },
  { value: 'FG', label: 'Finished Goods' },
  { value: 'SUB', label: 'Subcontract Store' },
  { value: 'REJECT', label: 'Rejected Store' }
];

const SalesOrders = () => {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [formMode, setFormMode] = useState('create'); // 'create', 'edit', 'view'
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [boms, setBoms] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [user, setUser] = useState(null);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const initialFormState = {
    series: 'Auto-generated',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    orderType: 'Sales',
    customerId: '',
    customerEmail: '',
    customerPhone: '',
    customerPoId: '',
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

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchOrders();
      fetchCompanies();
      if (parsedUser.department_code === 'ADMIN' || parsedUser.department_code === 'DESIGN_ENG' || parsedUser.department_code === 'SALES') {
        fetchBoms();
      }
    } else {
      fetchOrders();
      fetchCompanies();
      fetchBoms();
    }
  }, []);

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
             if (formData.sourceType === 'QUOTATION') return !q.isApprovedDrawing;
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/order`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
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
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
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
              created_at: quote.created_at,
              status: quote.status,
              po_number: quote.po_number,
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
            created_at: po.created_at,
            status: po.status,
            po_number: po.po_number,
            isCustomerPo: true,
            items: [] // Items will be fetched when selected if needed, or we can fetch them here
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
    const group = quotations.find(q => q.uniqueKey === uniqueKey);
    if (!group) return;

    let items = [];
    let avgProfit = 0;
    let avgGst = 18;
    let totalProfitVal = 0;
    let sourceType = 'QUOTATION';
    let quotationId = group.dbId;
    let bomId = null;
    let projectName = '';

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
          projectName = poData.remarks || `Order for ${poData.company_name}`;
          
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
              igst_percent: igst
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

      items = group.items.map(item => {
        const qty = Number(item.item_qty) || 1;
        const totalAmount = Number(item.total_amount) || 0;
        const profitP = Number(item.profit_percentage) || avgProfit;
        
        const quotedPrice = qty > 0 ? totalAmount / qty : 0;
        const baseRate = quotedPrice / (1 + (profitP / 100));
        const itemProfit = (quotedPrice - baseRate) * qty;
        totalProfitVal += itemProfit;
        
        return {
          item_code: item.drawing_no || 'Standard',
          drawing_no: item.drawing_no,
          description: item.item_description,
          type: item.item_group || 'Standard',
          quantity: qty,
          rate: baseRate,
          amount: baseRate * qty
        };
      });
    }

    setFormData(prev => ({
      ...prev,
      customerPoId: uniqueKey,
      items,
      profitMargin: parseFloat(avgProfit.toFixed(2)),
      totalProfit: parseFloat(totalProfitVal.toFixed(2)),
      cgstRate: parseFloat((avgGst / 2).toFixed(2)),
      sgstRate: parseFloat((avgGst / 2).toFixed(2)),
      sourceType,
      quotation_id: sourceType !== 'DIRECT' ? quotationId : null,
      customer_po_id: sourceType === 'DIRECT' ? quotationId : null,
      bomId: bomId || prev.bomId,
      projectName: projectName || prev.projectName
    }));
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
        }

        const subtotalInclusiveOfProfit = Number(data.subtotal) || 0;
        const baseItemsSubtotal = formattedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const totalProfitVal = subtotalInclusiveOfProfit - baseItemsSubtotal;

        setFormData({
          ...initialFormState,
          id: data.id,
          series: data.order_no || `ORD-${String(data.id).padStart(4, '0')}`,
          orderDate: data.order_date?.split('T')[0] || data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          deliveryDate: data.delivery_date ? data.delivery_date.split('T')[0] : (data.target_dispatch_date ? data.target_dispatch_date.split('T')[0] : ''),
          orderType: 'Sales',
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
          items: formattedItems
        });
        const companyId = data.client_id || data.company_id;
        if (companyId) {
          fetchApprovedQuotations(companyId);
        }
        setFormMode('edit');
        setViewMode('form');
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
          throw new Error('Failed to delete order');
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
          items: formData.items
        })
      });

      if (response.ok) {
        successToast(`Order ${formMode === 'create' ? 'created' : 'updated'} successfully`);
        setViewMode('list');
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
          <span className="font-bold text-indigo-600 tracking-tight">
            {val || `ORD-${String(row.id).padStart(4, '0')}`}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 uppercase">
              {row.order_type || 'Sales Order'}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Customer',
      key: 'client',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm">
            {val ? val.substring(0, 2).toUpperCase() : 'C'}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">{val}</span>
            <span className="text-[11px] text-slate-500 font-medium italic">
              {row.projectName || 'General Project'}
            </span>
          </div>
        </div>
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
              <div className={`w-2 h-2 rounded-full ${new Date(val) < new Date() ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-xs text-slate-600 font-medium">
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
          <div className="flex items-center gap-1 font-bold text-slate-900">
            <span className="text-indigo-600 font-medium">₹</span>
            <span>{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
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
      render: (_, row) => (
        <div className="flex justify-end items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => handleCreateShipment(row)} 
            className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100 group shadow-sm"
            title="Create Shipment"
          >
            <Truck className="w-4 h-4 group-hover:scale-110" />
          </button>
          <div className="h-4 w-[1px] bg-slate-100 mx-0.5" />
          <button 
            onClick={() => handleViewOrder(row)} 
            className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 group shadow-sm"
            title="View Details"
          >
            <Eye className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button 
            onClick={() => handleEditOrder(row)} 
            className="p-2 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-all border border-transparent hover:border-amber-100 group shadow-sm"
            title="Edit Order"
          >
            <Pencil className="w-4 h-4 group-hover:scale-110" />
          </button>
          <button 
            onClick={() => handleDeleteOrder(row.id)} 
            className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 group shadow-sm"
            title="Delete Order"
          >
            <Trash2 className="w-4 h-4 group-hover:scale-110" />
          </button>
        </div>
      )
    }
  ];

  if (viewMode === 'list') {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => ['DRAFT', 'CREATED', 'IN_PROGRESS'].includes(o.status?.toUpperCase())).length;
    const completedOrders = orders.filter(o => ['COMPLETED', 'FULFILLED', 'DELIVERED'].includes(o.status?.toUpperCase())).length;

    return (
      <div className="space-y-6 pb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
               <Package className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Orders</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  {totalOrders} Total
                </span>
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {pendingOrders} Processing
                </span>
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {completedOrders} Finalized
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={fetchOrders}
              className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-100"
              title="Refresh Data"
            >
              <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleAddOrder}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 text-sm font-bold"
            >
              <Plus className="w-5 h-5" />
              Create New Order
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-2">
          <DataTable 
            columns={columns}
            data={orders}
            loading={loading}
            searchPlaceholder="Search orders by number, customer or project..."
            className="border-none"
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
    <div className="space-y-2 pb-20">
      <div className="flex items-center gap-4 bg-white p-2 rounded  border border-slate-200  sticky top-0 z-10">
        <button 
          onClick={() => setViewMode('list')}
          className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-500"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded ">
                <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl text-slate-900">{formMode === 'create' ? 'New Sales Order' : formMode === 'edit' ? 'Edit Sales Order' : 'View Sales Order'}</h1>
              <p className="text-xs text-slate-500">Create and configure sales orders</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
              onClick={() => setViewMode('list')}
              className="p-2 bg-slate-100 text-slate-600 text-xs rounded  hover:bg-slate-200 transition-colors "
            >
              Cancel
            </button>
            {formMode !== 'view' && (
              <button 
                onClick={handleSaveOrder}
                className="p-2 bg-indigo-600 text-white rounded  hover:bg-indigo-700 transition-colors  shadow-lg text-xs text-xs"
              >
                {formMode === 'create' ? 'Save Sales Order' : 'Update Sales Order'}
              </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <Card title="Order Information" className='bg-white' subtitle="Basic details about the order">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              <FormControl label="Series">
                <input 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs bg-slate-50 text-slate-500" 
                  value={formData.series} 
                  disabled 
                />
              </FormControl>
              <FormControl label="Order Date *">
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.orderDate}
                  onChange={(e) => setFormData({...formData, orderDate: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Delivery Date">
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Order Type">
                <select 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.orderType}
                  onChange={(e) => setFormData({...formData, orderType: e.target.value})}
                  disabled={formMode === 'view'}
                >
                  <option value="Sales">Sales</option>
                  <option value="Internal">Internal</option>
                </select>
              </FormControl>
            </div>
          </Card>

          {/* Customer Details */}
          <Card title="Customer Details" className='bg-white' subtitle="Customer contact information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              <FormControl label="Customer *">
                <SearchableSelect 
                  options={companies.map(c => ({ value: c.id, label: c.company_name }))}
                  value={formData.customerId}
                  onChange={(e) => {
                    const company = companies.find(c => String(c.id) === String(e.target.value));
                    const primaryContact = company?.contacts?.find(ct => ct.contact_type === 'PRIMARY') || company?.contacts?.[0];
                    setFormData({
                      ...formData, 
                      customerId: e.target.value,
                      customerEmail: primaryContact?.email || company?.contact_email || '',
                      customerPhone: primaryContact?.phone || company?.contact_mobile || '',
                      customerPoId: ''
                    });
                    if (e.target.value) {
                      fetchApprovedQuotations(e.target.value);
                    }
                  }}
                  placeholder="Select customer..."
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Email">
                <input 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Phone">
                <input 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
            </div>
          </Card>

          {/* Customer Purchase Order and storage */}
          <Card title="Customer Purchase Order and storage" className='bg-white' subtitle="PO & Inventory">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <FormControl label="Select Customer PO *">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect 
                      options={quotations
                        .filter(q => q.isCustomerPo)
                        .map(q => ({
                          value: q.uniqueKey, 
                          label: `PO: ${q.po_number} - ${q.status}`
                        }))}
                      value={formData.customerPoId}
                      onChange={(e) => handleCustomerPoChange(e.target.value)}
                      placeholder="Select Customer PO..."
                      disabled={formMode === 'view'}
                    />
                  </div>
                  {formData.customerPoId && (
                    <button
                      type="button"
                      className="p-2 bg-indigo-50 text-indigo-600 rounded  hover:bg-indigo-100 transition-colors border border-indigo-100"
                      title="View PO PDF"
                      onClick={handleViewPoPdf}
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </FormControl>
              <FormControl label="Warehouse">
                <select 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.warehouse}
                  onChange={(e) => setFormData({...formData, warehouse: e.target.value})}
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
              <div className="p-2 bg-blue-50/50 rounded  mb-4 border border-blue-100 flex items-center gap-4">
                <div className="p-2 bg-white rounded   border border-blue-100">
                    <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm  text-slate-900">Items <span className="text-slate-400 font-normal ml-1">({formData.items.length})</span></p>
                  <p className="text-[10px] text-indigo-600  ">PO Number: {formData.customerPoId ? (String(formData.customerPoId).includes('_') ? formData.customerPoId.split('_')[1] : formData.customerPoId) : 'N/A'}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded ">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 ">
                    <tr>
                      <th className="p-2  text-left">Item Code</th>
                      <th className="p-2  text-left">Type</th>
                      <th className="p-2  text-center w-24">Qty</th>
                      <th className="p-2  text-right">Rate</th>
                      <th className="p-2  text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2    text-indigo-600">
                          {item.drawing_no || item.item_code}
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{item.description}</div>
                        </td>
                        <td className="p-2  text-slate-500">{item.type || 'Standard'}</td>
                        <td className="p-2  text-center">
                          {item.quantity}
                        </td>
                        <td className="p-2  text-right text-slate-600">₹ {(Number(item.rate) || 0).toFixed(2)}</td>
                        <td className="p-2  text-right  text-emerald-600">₹ {(Number(item.amount) || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Order Status & Taxes */}
          <Card title="Order Status & Taxes" className='bg-white'>
            <div className="space-y-4 p-4">
              <FormControl label="Status">
                <select 
                  className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  disabled={formMode === 'view'}
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </FormControl>
              <div className="grid grid-cols-2 gap-4">
                <FormControl label="CGST Rate (%)">
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                    value={formData.cgstRate}
                    onChange={(e) => setFormData({...formData, cgstRate: Number(e.target.value)})}
                    disabled={formMode === 'view'}
                  />
                </FormControl>
                <FormControl label="SGST Rate (%)">
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded  text-xs" 
                    value={formData.sgstRate}
                    onChange={(e) => setFormData({...formData, sgstRate: Number(e.target.value)})}
                    disabled={formMode === 'view'}
                  />
                </FormControl>
              </div>
            </div>
          </Card>

          {/* Price Summary */}
          <Card title="Order Summary" className='bg-white'>
            <div className="space-y-3 p-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Items Subtotal:</span>
                <span className=" text-slate-700">₹ {(Number(subTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs pt-3 border-t border-slate-100 font-medium text-blue-600">
                <span>Total Profit:</span>
                <span>₹ {(Number(totalProfitVal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Tax (GST {cgstRateVal + sgstRateVal}%):</span>
                <span className=" text-slate-700">₹ {(Number(gstAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                   <p className="text-sm font-semibold text-slate-700">Total Order Value:</p>
                </div>
                <div className="text-right">
                   <p className="text-xl font-bold text-emerald-600">₹ {(Number(totalAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
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

