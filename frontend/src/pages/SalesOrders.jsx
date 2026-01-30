import React, { useState, useEffect } from 'react';
import { Card, DataTable, FormControl, StatusBadge, Badge, SearchableSelect } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');
const API_HOST = API_BASE.replace(/\/api$/, '');

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
  const [customerPos, setCustomerPos] = useState([]);
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
    warehouse: '',
    status: 'CREATED',
    cgstRate: 9,
    sgstRate: 9,
    profitMargin: 0,
    items: []
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      fetchOrders();
      fetchCompanies();
      fetchCustomerPos();
    } else {
      fetchOrders();
      fetchCompanies();
      fetchCustomerPos();
    }
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders`, {
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

  const fetchCustomerPos = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const [poRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/customer-pos`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/quotation-requests?status=APPROVED,COMPLETED,APPROVAL`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      let combinedData = [];

      if (poRes.ok) {
        const poData = await poRes.json();
        combinedData = [...(Array.isArray(poData) ? poData : [])];
      }

      if (quoteRes.ok) {
        const quotes = await quoteRes.json();
        // Group quotations by company and time to match QRT-xxxx batches
        const grouped = {};
        quotes.forEach(quote => {
          const date = new Date(quote.created_at);
          const roundedTime = Math.floor(date.getTime() / 10000) * 10000;
          const key = `QRT_${quote.company_id}_${roundedTime}`;
          
          if (!grouped[key]) {
            grouped[key] = {
              id: `QRT-${quote.id}`,
              po_number: `QRT-${String(quote.id).padStart(4, '0')}`,
              company_id: quote.company_id,
              company_name: quote.company_name,
              status: 'APPROVED',
              isQuotation: true,
              created_at: quote.created_at,
              items: []
            };
          }
          grouped[key].items.push({
            item_code: quote.drawing_no || quote.item_code || '—',
            description: quote.item_description || '—',
            type: 'Finished Good',
            quantity: Number(quote.item_qty) || 0,
            rate: Number(quote.total_amount) / (Number(quote.item_qty) || 1),
            amount: Number(quote.total_amount),
            drawing_no: quote.drawing_no
          });
        });
        combinedData = [...combinedData, ...Object.values(grouped)];
      }

      setCustomerPos(combinedData);
    } catch (err) {
      console.error('Error fetching customer POs/Quotations:', err);
    }
  };

  const handleAddOrder = () => {
    setFormData(initialFormState);
    setFormMode('create');
    setViewMode('form');
  };

  const handleEditOrder = async (order) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          ...initialFormState,
          id: data.id,
          series: `SO-${String(data.id).padStart(4, '0')}`,
          orderDate: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          deliveryDate: data.target_dispatch_date || '',
          orderType: 'Sales',
          customerId: data.company_id || '',
          customerEmail: data.contact_email || data.customer_email || data.email || '',
          customerPhone: data.contact_mobile || data.customer_phone || data.phone || '',
          customerPoId: data.customer_po_id || '',
          warehouse: data.warehouse || '',
          status: data.status || 'CREATED',
          cgstRate: data.cgst_rate || 0,
          sgstRate: data.sgst_rate || 0,
          profitMargin: data.profit_margin || 0,
          items: data.items || []
        });
        setFormMode('edit');
        setViewMode('form');
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      errorToast('Failed to fetch order details');
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
        const response = await fetch(`${API_BASE}/sales-orders/${id}`, {
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
      const url = formMode === 'create' ? `${API_BASE}/sales-orders` : `${API_BASE}/sales-orders/${formData.id}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId: formData.customerId,
          targetDispatchDate: formData.deliveryDate || null,
          status: formData.status,
          items: formData.items,
          cgst_rate: formData.cgstRate,
          sgst_rate: formData.sgstRate,
          profit_margin: formData.profitMargin,
          customerPoId: formData.customerPoId,
          warehouse: formData.warehouse
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

  const handlePoChange = async (poId) => {
    if (!poId) return;

    // Check if it's a quotation from our combined list
    if (String(poId).startsWith('QRT-')) {
      const quote = customerPos.find(p => String(p.id) === String(poId));
      if (quote) {
        setFormData(prev => ({
          ...prev,
          customerPoId: poId,
          customerId: quote.company_id,
          // We don't have email/phone in the grouped quote object easily, 
          // but the customer select will handle it if needed, or we can fetch company
          items: quote.items
        }));
        
        // Fetch company details to populate email/phone
        try {
          const token = localStorage.getItem('authToken');
          const res = await fetch(`${API_BASE}/companies/${quote.company_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const company = await res.json();
            const primaryContact = Array.isArray(company?.contacts) 
              ? company.contacts.find(c => (c.contact_type || c.contactType) === 'PRIMARY') || company.contacts[0]
              : null;

            setFormData(prev => ({
              ...prev,
              customerEmail: company.contact_email || company.customer_email || company.email || primaryContact?.email || '',
              customerPhone: company.contact_mobile || company.customer_phone || company.phone || primaryContact?.phone || ''
            }));
          }
        } catch (err) {
          console.error('Error fetching company for quotation:', err);
        }
      }
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/customer-pos/${poId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const poDetails = await response.json();
        
        const items = poDetails.items.map(item => ({
          item_code: item.item_code,
          description: item.description,
          type: 'Finished Good',
          quantity: item.quantity,
          rate: Number(item.rate),
          amount: Number(item.rate) * Number(item.quantity),
          drawing_no: item.drawing_no
        }));

        setFormData(prev => ({
          ...prev,
          customerPoId: poId,
          customerId: poDetails.company_id,
          customerEmail: poDetails.contact_email || poDetails.customer_email || poDetails.email || '',
          customerPhone: poDetails.contact_mobile || poDetails.customer_phone || poDetails.phone || '',
          items
        }));
      }
    } catch (err) {
      console.error('Error fetching PO details:', err);
    }
  };

  const columns = [
    {
      label: 'Order No',
      key: 'id',
      sortable: true,
      render: (val) => <span className="font-mono text-indigo-600">SO-{String(val).padStart(4, '0')}</span>
    },
    {
      label: 'Customer',
      key: 'company_name',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    {
      label: 'Order Date',
      key: 'created_at',
      sortable: true,
      render: (val) => <span>{new Date(val).toLocaleDateString()}</span>
    },
    {
      label: 'Delivery Date',
      key: 'target_dispatch_date',
      sortable: true,
      render: (val) => <span>{val ? new Date(val).toLocaleDateString() : '—'}</span>
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
            <h1 className="text-2xl  text-slate-900">New Sales Orders</h1>
            <p className="text-sm text-slate-500">View and manage new sales orders that haven't been processed by other departments yet.</p>
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
  const subTotal = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const costWithProfit = subTotal * (1 + (formData.profitMargin / 100));
  const gstAmount = costWithProfit * ((formData.cgstRate + formData.sgstRate) / 100);
  const totalAmount = costWithProfit + gstAmount;

  const filteredCustomerPos = customerPos.filter(po => {
    const matchesCustomer = !formData.customerId || String(po.company_id) === String(formData.customerId);
    const isApproved = po.status === 'APPROVED' || po.status === 'COMPLETED'; 
    return matchesCustomer && isApproved;
  });

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
                    const primaryContact = Array.isArray(company?.contacts) 
                      ? company.contacts.find(c => (c.contact_type || c.contactType) === 'PRIMARY') || company.contacts[0]
                      : null;
                    
                    setFormData({
                      ...formData, 
                      customerId: e.target.value,
                      customerEmail: company?.contact_email || company?.customer_email || company?.email || primaryContact?.email || '',
                      customerPhone: company?.contact_mobile || company?.customer_phone || company?.phone || primaryContact?.phone || '',
                      customerPoId: '',
                      items: []
                    });
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

          {/* PO & Inventory */}
          <Card title="PO & Inventory" subtitle="Customer Purchase Order and storage">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              <FormControl label="Select Customer PO *">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect 
                      options={filteredCustomerPos.map(po => ({ value: po.id, label: `${po.po_number} (${po.status})` }))}
                      value={formData.customerPoId}
                      onChange={(e) => handlePoChange(e.target.value)}
                      placeholder="Select Customer PO..."
                      disabled={formMode === 'view'}
                      allowCustom={false}
                    />
                  </div>
                  {formData.customerPoId && (
                    <button
                      type="button"
                      onClick={() => {
                        const po = customerPos.find(p => String(p.id) === String(formData.customerPoId));
                        if (po) {
                          window.open(`${API_HOST}/${po.pdf_path}`, '_blank');
                        }
                      }}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100"
                      title="View PO PDF"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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

          {/* PO Item Details */}
          {formData.items.length > 0 && (
            <Card title="Order Items" subtitle="Items included in selected PO">
              <div className="p-4 bg-blue-50/50 rounded-xl mb-4 border border-blue-100 flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-blue-100">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                </div>
                <div>
                  <p className="text-sm  text-slate-900">Items <span className="text-slate-400 font-normal ml-1">({formData.items.length})</span></p>
                  <p className="text-[10px] text-slate-500 mt-0.5">PO Number: <span className=" text-slate-700">{customerPos.find(p => String(p.id) === String(formData.customerPoId))?.po_number || '—'}</span></p>
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
                        <td className="px-4 py-3 font-mono text-indigo-600">{item.item_code}</td>
                        <td className="px-4 py-3 text-slate-500">{item.type}</td>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="number" 
                            className="w-16 text-center border-none bg-transparent focus:ring-0 p-0 " 
                            value={item.quantity}
                            onChange={(e) => {
                                const newItems = [...formData.items];
                                newItems[idx].quantity = Number(e.target.value);
                                newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
                                setFormData({...formData, items: newItems});
                            }}
                            disabled={formMode === 'view'}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">₹ {Number(item.rate || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right  text-emerald-600">₹ {Number(item.amount || 0).toFixed(2)}</td>
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
                  <option value="CREATED">Created</option>
                  <option value="DESIGN_IN_REVIEW">Design in Review</option>
                  <option value="IN_PRODUCTION">In Production</option>
                  <option value="CLOSED">Closed</option>
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
                <span className=" text-slate-700">₹ {Number(subTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs pt-3 border-t border-slate-100">
                <span className="text-slate-500">Subtotal with Profit ({formData.profitMargin}%):</span>
                <span className=" text-slate-700">₹ {Number(costWithProfit || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">GST ({formData.cgstRate + formData.sgstRate}%):</span>
                <span className=" text-slate-700">₹ {Number(gstAmount || 0).toFixed(2)}</span>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                   <p className="text-sm  text-slate-900">Total Order Value:</p>
                </div>
                <div className="text-right">
                   <p className="text-2xl  text-emerald-600">₹ {Number(totalAmount || 0).toFixed(2)}</p>
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

