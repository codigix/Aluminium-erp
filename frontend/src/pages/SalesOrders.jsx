import React, { useState, useEffect } from 'react';
import { Card, DataTable, FormControl, StatusBadge, Badge, SearchableSelect } from '../components/ui.jsx';
import { Truck } from 'lucide-react';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
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
      const [quotesRes, approvedRes] = await Promise.all([
        fetch(`${API_BASE}/quotation-requests?status=APPROVED,COMPLETED,ACCEPTED&company_id=${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/order/approved-drawings?company_id=${companyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      let allOptions = [];

      if (quotesRes.ok) {
        const data = await quotesRes.json();
        // Ensure data is array before filtering
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

      if (approvedRes.ok) {
        const data = await approvedRes.json();
        const companyApproved = Array.isArray(data) ? data.filter(o => String(o.company_id) === String(companyId)) : [];
        
        companyApproved.forEach(order => {
          const fgItems = (order.items || []).filter(item => item.item_group === 'FG');
          if (fgItems.length > 0) {
            const key = `APPROVED_${order.id}`;
            allOptions.push({
              id: order.id,
              dbId: order.id,
              uniqueKey: key,
              company_id: order.company_id,
              created_at: order.created_at,
              status: 'APPROVED_DRAWING',
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

  const handleCustomerPoChange = (uniqueKey) => {
    const group = quotations.find(q => q.uniqueKey === uniqueKey);
    if (!group) return;

    const items = group.items.map(item => {
      const qty = Number(item.item_qty) || 1;
      const totalAmount = Number(item.total_amount) || 0;
      const rate = qty > 0 ? totalAmount / qty : 0;
      return {
        item_code: item.drawing_no || 'Standard',
        drawing_no: item.drawing_no,
        description: item.item_description,
        type: item.item_group || 'Standard',
        quantity: qty,
        rate: rate,
        amount: totalAmount
      };
    });

    setFormData(prev => ({
      ...prev,
      customerPoId: uniqueKey,
      items
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
          mappedPoId = `APPROVED_${data.quotation_id}`;
        }

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
          subtotal: Number(data.subtotal) || 0,
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

  const handleSaveOrder = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const method = formMode === 'create' ? 'POST' : 'PUT';
      const url = formMode === 'create' ? `${API_BASE}/order` : `${API_BASE}/order/${formData.id}`;

      // Calculate totals for the new schema
      const subTotalVal = (formData.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const profitMarginVal = Number(formData.profitMargin) || 0;
      const costWithProfit = subTotalVal * (1 + (profitMarginVal / 100));
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
      label: 'Order No',
      key: 'order_no',
      sortable: true,
      render: (val, row) => <span className="font-mono text-indigo-600">{val || `ORD-${String(row.id).padStart(4, '0')}`}</span>
    },
    {
      label: 'Customer',
      key: 'client',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    {
      label: 'Order Date',
      key: 'order_date',
      sortable: true,
      render: (val, row) => <span>{new Date(val || row.created_at).toLocaleDateString()}</span>
    },
    {
      label: 'Delivery Date',
      key: 'delivery_date',
      sortable: true,
      render: (val) => <span>{val ? new Date(val).toLocaleDateString() : '—'}</span>
    },
    {
      label: 'Grand Total',
      key: 'grand_total',
      sortable: true,
      render: (val) => <span className="font-medium text-slate-900">₹{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleCreateShipment(row)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors" title="Create Shipment">
            <Truck className="w-4 h-4" />
          </button>
          <button onClick={() => handleViewOrder(row)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" title="View">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>
          <button onClick={() => handleEditOrder(row)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-600 transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onClick={() => handleDeleteOrder(row.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      )
    }
  ];

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl  text-slate-900">Sales Orders</h1>
            <p className="text-sm text-slate-500">Manage your sales orders and production workflow</p>
          </div>
          <button 
            onClick={handleAddOrder}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 "
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Sales Order
          </button>
        </div>

        <DataTable 
          columns={columns}
          data={orders}
          loading={loading}
          searchPlaceholder="Search sales orders..."
        />
      </div>
    );
  }

  // Form View
  const selectedBom = boms.find(b => String(b.id) === String(formData.bomId));
  const subTotal = (formData.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const profitMarginVal = Number(formData.profitMargin) || 0;
  const costWithProfit = subTotal * (1 + (profitMarginVal / 100));
  const cgstRateVal = Number(formData.cgstRate) || 0;
  const sgstRateVal = Number(formData.sgstRate) || 0;
  const gstAmount = costWithProfit * ((cgstRateVal + sgstRateVal) / 100);
  const totalAmount = costWithProfit + gstAmount;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-10">
        <button 
          onClick={() => setViewMode('list')}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
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
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors "
            >
              Cancel
            </button>
            {formMode !== 'view' && (
              <button 
                onClick={handleSaveOrder}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors  shadow-lg shadow-indigo-200"
              >
                {formMode === 'create' ? 'Save Sales Order' : 'Update Sales Order'}
              </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <Card title="Order Information" subtitle="Basic details about the order">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              <FormControl label="Series">
                <input 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-500" 
                  value={formData.series} 
                  disabled 
                />
              </FormControl>
              <FormControl label="Order Date *">
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  value={formData.orderDate}
                  onChange={(e) => setFormData({...formData, orderDate: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Delivery Date">
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({...formData, deliveryDate: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Order Type">
                <select 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
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
          <Card title="Customer Details" subtitle="Customer contact information">
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
              <FormControl label="Phone">
                <input 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
            </div>
          </Card>

          {/* Customer Purchase Order and storage */}
          <Card title="Customer Purchase Order and storage" subtitle="PO & Inventory">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <FormControl label="Select Customer PO *">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect 
                      options={quotations.map(q => ({ 
                        value: q.uniqueKey, 
                        label: `${q.isApprovedDrawing ? `DRW: ${q.id}` : `QRT-${q.id.toString().padStart(4, '0')}`} ${q.po_number ? `(PO: ${q.po_number})` : ''} - ${q.status}` 
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
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100"
                      title="View Details"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  )}
                </div>
              </FormControl>
              <FormControl label="Warehouse">
                <select 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
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
            <Card title="Items included in selected PO" subtitle="Order Items">
              <div className="p-4 bg-blue-50/50 rounded-xl mb-4 border border-blue-100 flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-blue-100">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                </div>
                <div>
                  <p className="text-sm  text-slate-900">Items <span className="text-slate-400 font-normal ml-1">({formData.items.length})</span></p>
                  <p className="text-[10px] text-indigo-600 font-mono">PO Number: {formData.customerPoId ? (String(formData.customerPoId).includes('_') ? formData.customerPoId.split('_')[1] : formData.customerPoId) : 'N/A'}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 ">
                    <tr>
                      <th className="px-4 py-3 text-left">Item Code</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-center w-24">Qty</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-indigo-600">
                          {item.drawing_no || item.item_code}
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{item.description}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.type || 'Standard'}</td>
                        <td className="px-4 py-3 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">₹ {(Number(item.rate) || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right  text-emerald-600">₹ {(Number(item.amount) || 0).toFixed(2)}</td>
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
          <Card title="Order Status & Taxes">
            <div className="space-y-4 p-4">
              <FormControl label="Status">
                <select 
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                    value={formData.cgstRate}
                    onChange={(e) => setFormData({...formData, cgstRate: Number(e.target.value)})}
                    disabled={formMode === 'view'}
                  />
                </FormControl>
                <FormControl label="SGST Rate (%)">
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                    value={formData.sgstRate}
                    onChange={(e) => setFormData({...formData, sgstRate: Number(e.target.value)})}
                    disabled={formMode === 'view'}
                  />
                </FormControl>
              </div>
              <FormControl label="Profit Margin (%)">
                <input 
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" 
                  value={formData.profitMargin}
                  onChange={(e) => setFormData({...formData, profitMargin: Number(e.target.value)})}
                  disabled={formMode === 'view'}
                />
              </FormControl>
            </div>
          </Card>

          {/* Price Summary */}
          <Card title="Order Summary">
            <div className="space-y-3 p-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Items Subtotal:</span>
                <span className=" text-slate-700">₹ {(Number(subTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs pt-3 border-t border-slate-100">
                <span className="text-slate-500">Subtotal with Profit ({profitMarginVal}%):</span>
                <span className=" text-slate-700">₹ {(Number(costWithProfit) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">GST ({cgstRateVal + sgstRateVal}%):</span>
                <span className=" text-slate-700">₹ {(Number(gstAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                   <p className="text-sm  text-slate-900">Total Order Value:</p>
                </div>
                <div className="text-right">
                   <p className="text-2xl  text-emerald-600 font-bold">₹ {(Number(totalAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors  flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Back
        </button>
        {formMode !== 'view' && (
          <button 
            onClick={handleSaveOrder}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors  shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
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

