import React, { useState, useMemo } from 'react'
import { 
  Loader2, ChevronRight, Eye, Plus, Trash2, X, Download, 
  Search, RefreshCw, Filter, FileText, Calendar, Building2,
  DollarSign, Package, CheckCircle2, Clock, AlertCircle
} from 'lucide-react'
import { Card, DataTable } from '../components/ui.jsx'

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Clock },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  COMPLETED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: CheckCircle2 },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertCircle },
};

const CustomerPO = ({
  formatCurrency,
  customerPos = [],
  customerPosLoading,
  companies = [],
  apiRequest,
  showToast,
  onRefresh,
  quotationRequests = [],
  quotationRequestsLoading
}) => {
  const [showPoForm, setShowPoForm] = useState(false)
  const [poFormLoading, setPoFormLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedQuoteId, setSelectedQuoteId] = useState('')
  const [viewingPo, setViewingPo] = useState(null)
  const [loadingPoDetails, setLoadingPoDetails] = useState(false)

  const [poForm, setPoForm] = useState({
    companyId: '',
    projectName: '',
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0],
    poVersion: '1.0',
    orderType: 'STANDARD',
    currency: 'INR',
    paymentTerms: '',
    creditDays: '',
    remarks: '',
    items: [
      {
        drawingNo: '',
        description: '',
        quantity: '',
        unit: 'NOS',
        rate: '',
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: 0
      }
    ]
  })

  // Auto-generate PO Number when form opens
  React.useEffect(() => {
    if (showPoForm && !poForm.poNumber) {
      const year = new Date().getFullYear();
      const count = (customerPos?.length || 0) + 1;
      const autoPo = `PO-${year}-${count.toString().padStart(3, '0')}`;
      setPoForm(prev => ({ ...prev, poNumber: autoPo }));
    }
  }, [showPoForm, customerPos]);

  const handleQuotationSelect = (quoteId) => {
    setSelectedQuoteId(quoteId);
    if (!quoteId) return;

    const quote = quotationRequests.find(q => q.id === parseInt(quoteId));
    if (quote) {
      // Find all items in the same version batch
      const relatedItems = quotationRequests.filter(q => {
        // Group items that belong to the SAME version of the SAME quotation revision set
        if (quote.batch_id && q.batch_id) {
          return q.batch_id === quote.batch_id;
        }
        
        // Fallback to legacy grouping
        return q.company_id === quote.company_id && 
               q.sales_order_id === quote.sales_order_id &&
               q.version === quote.version;
      });

      // Map items from the batch. We include them if they are part of the latest batch,
      // as usually only the "Approved" one was clicked but we want the whole set.
      const items = relatedItems
        .map(item => {
          const qty = parseFloat(item.item_qty) || 0;
          const totalAmount = parseFloat(item.total_amount) || 0;
          const unitRate = qty > 0 ? (totalAmount / qty) : totalAmount;
          
          return {
            drawingNo: item.drawing_no !== '—' ? item.drawing_no : '',
            description: item.item_description,
            quantity: qty,
            unit: item.item_unit || 'NOS',
            rate: unitRate.toFixed(2),
            cgstPercent: (item.gst_percentage || 18) / 2,
            sgstPercent: (item.gst_percentage || 18) / 2,
            igstPercent: 0
          };
        });

      setPoForm(prev => ({
        ...prev,
        companyId: quote.company_id,
        projectName: quote.project_name || '',
        items: items.length > 0 ? items : prev.items
      }));
      
      showToast(`Loaded ${items.length} items from quotation QRT-${String(quote.id).padStart(4, '0')} (Version ${quote.version || 1})`);
    }
  };

  const filteredPOs = useMemo(() => {
    return customerPos.filter(po => {
      const matchesSearch = 
        po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [customerPos, searchTerm, statusFilter]);

  const handleAddItem = () => {
    setPoForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          drawingNo: '',
          description: '',
          quantity: '',
          unit: 'NOS',
          rate: '',
          cgstPercent: 0,
          sgstPercent: 0,
          igstPercent: 0
        }
      ]
    }))
  }

  const handleRemoveItem = (index) => {
    if (poForm.items.length === 1) return
    setPoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...poForm.items]
    newItems[index][field] = value
    setPoForm(prev => ({ ...prev, items: newItems }))
  }

  const closePoForm = () => {
    setShowPoForm(false)
    setSelectedQuoteId('')
    setPoForm({
      companyId: '',
      projectName: '',
      poNumber: '',
      poDate: new Date().toISOString().split('T')[0],
      poVersion: '1.0',
      orderType: 'STANDARD',
      currency: 'INR',
      paymentTerms: '',
      creditDays: '',
      remarks: '',
      items: [
        {
          drawingNo: '',
          description: '',
          quantity: '',
          unit: 'NOS',
          rate: '',
          cgstPercent: 0,
          sgstPercent: 0,
          igstPercent: 0
        }
      ]
    })
  }

  const handlePoSubmit = async (e) => {
    e.preventDefault()
    if (!poForm.companyId) {
      showToast('Please select a company')
      return
    }
    
    setPoFormLoading(true)
    try {
      const payload = {
        companyId: poForm.companyId,
        projectName: poForm.projectName,
        poNumber: poForm.poNumber,
        poDate: poForm.poDate,
        poVersion: poForm.poVersion,
        orderType: poForm.orderType,
        currency: poForm.currency,
        paymentTerms: poForm.paymentTerms,
        creditDays: poForm.creditDays,
        items: poForm.items,
        remarks: poForm.remarks
      }
      
      await apiRequest('/customer-pos', {
        method: 'POST',
        body: payload
      })
      showToast('Customer PO created successfully')
      closePoForm()
      if (onRefresh) onRefresh()
    } catch (error) {
      showToast(error.message)
    } finally {
      setPoFormLoading(false)
    }
  }

  const fetchPoDetails = async (poId) => {
    setLoadingPoDetails(true);
    try {
      const data = await apiRequest(`/customer-pos/${poId}`);
      setViewingPo(data);
    } catch (error) {
      showToast(error.message || 'Failed to fetch PO details');
    } finally {
      setLoadingPoDetails(false);
    }
  };

  const handleDownloadPdf = async (poId, poNumber) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${baseUrl}/customer-pos/${poId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      showToast(error.message);
    }
  };

  const columns = [
    {
      label: 'PO Details',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-xs  text-slate-900 font-bold  tracking-tight">{row.po_number}</p>
        </div>
      )
    },
    {
      label: 'Client & Project',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-900">{row.company_name}</span>
          <span className="text-[11px] text-slate-500 italic">
            {row.project_name || 'General Project'}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
            <Calendar className="w-3 h-3" />
            <span className="text-[10px]">
              {new Date(row.po_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Amount',
      render: (_, row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-emerald-600 ">
            <span className="text-xs ">{formatCurrency(row.net_total)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400  ">
            <span>Incl. Taxes</span>
          </div>
        </div>
      )
    },
    {
      label: 'Action',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => handleDownloadPdf(row.id, row.po_number)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all border border-transparent hover:border-indigo-100  hover:"
            title="View PDF"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button 
            onClick={() => fetchPoDetails(row.id)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all border border-transparent hover:border-indigo-100  hover:"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl  text-slate-900  flex items-center gap-2">
            Customer Purchase Orders
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-md   ">Enterprise</span>
          </h1>
          <p className="text-slate-500 text-xs ">Manage and track external purchase orders from your clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onRefresh && onRefresh()}
            className="p-2.5 text-slate-500 hover:bg-white hover:text-indigo-600 rounded  transition-all border border-slate-200 bg-slate-50/50  active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowPoForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white p-2  rounded text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Purchase Order
          </button>
        </div>
      </div>

      {/* Stats Section (Optional - can be added later if needed) */}
      <div className="grid grid-cols-1 my-4 md:grid-cols-4 gap-2">
        {[
          { label: 'Total Orders', value: customerPos.length, color: 'indigo', icon: FileText },
          { label: 'Pending Approval', value: customerPos.filter(p => p.status === 'PENDING').length, color: 'amber', icon: Clock },
          { label: 'Completed', value: customerPos.filter(p => p.status === 'COMPLETED').length, color: 'emerald', icon: CheckCircle2 },
          { label: 'Total Value', value: formatCurrency(customerPos.reduce((sum, p) => sum + (parseFloat(p.net_total) || 0), 0)), color: 'blue', icon: DollarSign },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200 rounded p-2  hover: transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs  text-slate-400  ">{stat.label}</p>
                  <p className="text-xl  text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 bg-${stat.color}-50 text-${stat.color}-600 rounded `}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row mb-3 items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by PO number or client name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 p-2 bg-white border border-slate-200 rounded text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all  font-medium"
          />
        </div>
        <div className="flex items-center gap-2 p-2  bg-white border border-slate-200 rounded  w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400   ">Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs  text-indigo-600 outline-none bg-transparent cursor-pointer min-w-[100px]"
          >
            <option value="ALL">All Orders</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded border border-slate-200  overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredPOs}
          loading={customerPosLoading}
          hideHeader={true}
          className="border-none shadow-none rounded-none"
        />
        {filteredPOs.length === 0 && !customerPosLoading && (
          <div className="py-20 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900  text-lg">No orders found</h3>
            <p className="text-slate-500 text-xs  font-medium">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* Manual PO Form Modal */}
      {showPoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={closePoForm} />
          <div className="relative w-full max-w-5xl bg-white shadow-2xl rounded  flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
            {/* Modal Header */}
            <div className="p-2  border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div>
                <h2 className="text-xl  text-slate-900 ">New Customer Purchase Order</h2>
                <p className="text-xs text-slate-500    mt-1">Manual Data Entry Workflow</p>
              </div>
              <button 
                onClick={closePoForm}
                className="p-2 rounded hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-900 active:scale-90 bg-slate-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              <form onSubmit={handlePoSubmit} id="po-manual-form" className="space-y-10">
                {/* Header Information Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm  text-slate-800  ">General Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Quotation No (Fetch Details)</label>
                      <select 
                        value={selectedQuoteId}
                        onChange={(e) => handleQuotationSelect(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700 appearance-none"
                      >
                        <option value="">Manual Entry (No Quotation)</option>
                        {(() => {
                          const batches = [];
                          const processedIds = new Set();
                          
                          // First, filter only approved items
                          const approvedItems = quotationRequests.filter(q => q.status?.trim().toUpperCase() === 'APPROVED');
                          
                          approvedItems.forEach(q => {
                            if (processedIds.has(q.id)) return;
                            
                            // Group items that belong to the SAME version of the SAME quotation revision set
                            const batchItems = approvedItems.filter(t => 
                              t.company_id === q.company_id && 
                              t.sales_order_id === q.sales_order_id &&
                              t.version === q.version
                            );
                            
                            // Use the smallest ID as representative for the dropdown value
                            const representative = batchItems.reduce((min, cur) => cur.id < min.id ? cur : min, batchItems[0]);
                            
                            // Double check: don't add duplicate batches (same SO + same version)
                            const isAlreadyAdded = batches.some(b => 
                              b.sales_order_id === representative.sales_order_id && 
                              b.version === representative.version
                            );
                            
                            if (!isAlreadyAdded) {
                              batches.push(representative);
                            }
                            
                            batchItems.forEach(item => processedIds.add(item.id));
                          });
                          
                          return batches.map(q => (
                            <option key={q.id} value={q.id}>
                              QRT-{String(q.id).padStart(4, '0')} - {q.company_name} ({q.project_name || 'No Project'}) {q.version > 1 ? `(V${q.version})` : ''}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Project Name</label>
                      <input 
                        type="text"
                        value={poForm.projectName}
                        onChange={(e) => setPoForm(prev => ({ ...prev, projectName: e.target.value }))}
                        placeholder="Project name..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Company / Client *</label>
                      <select 
                        required
                        value={poForm.companyId}
                        onChange={(e) => setPoForm(prev => ({ ...prev, companyId: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700 appearance-none"
                      >
                        <option value="">Select Company</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.company_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">PO Number *</label>
                      <input 
                        required
                        type="text"
                        value={poForm.poNumber}
                        onChange={(e) => setPoForm(prev => ({ ...prev, poNumber: e.target.value }))}
                        placeholder="e.g. PO/2026/001"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">PO Date *</label>
                      <input 
                        required
                        type="date"
                        value={poForm.poDate}
                        onChange={(e) => setPoForm(prev => ({ ...prev, poDate: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Payment Terms</label>
                      <input 
                        type="text"
                        value={poForm.paymentTerms}
                        onChange={(e) => setPoForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        placeholder="e.g. 30 Days Net"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Credit Days</label>
                      <input 
                        type="number"
                        value={poForm.creditDays}
                        onChange={(e) => setPoForm(prev => ({ ...prev, creditDays: e.target.value }))}
                        placeholder="e.g. 30"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Currency</label>
                      <select 
                        value={poForm.currency}
                        onChange={(e) => setPoForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700 appearance-none"
                      >
                        <option value="INR">INR - Indian Rupee</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Line Items Section */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
                        <Package className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm  text-slate-800  ">Purchase Items</h3>
                    </div>
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded  text-xs    hover:bg-indigo-100 transition-all active:scale-95 "
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      Add Line Item
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded border-2 border-slate-100 bg-white ">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-100">
                          <th className="p-2  text-xs  text-slate-400   text-left w-32">Drawing No *</th>
                          <th className="p-2  text-xs  text-slate-400   text-left">Description *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-24">Qty *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">Unit</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-32">Rate *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">CGST %</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">SGST %</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">IGST %</th>
                          <th className="p-2  text-xs  text-slate-400   text-right pr-6 w-32">Total</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {poForm.items.map((item, index) => {
                          const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                          const tax = subtotal * ((parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0) + (parseFloat(item.igstPercent) || 0)) / 100;
                          const total = subtotal + tax;
                          
                          return (
                            <tr key={index} className="group hover:bg-indigo-50/30 transition-all">
                              <td className="p-2">
                                <input 
                                  required
                                  type="text"
                                  value={item.drawingNo}
                                  onChange={(e) => handleItemChange(index, 'drawingNo', e.target.value)}
                                  placeholder="DRW-101"
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  required
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  placeholder="Item description..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  required
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  required
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600 "
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  required
                                  type="number"
                                  value={item.rate}
                                  onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                  className="w-full bg-indigo-50 border border-indigo-100 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-indigo-600 placeholder:text-indigo-200"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  type="number"
                                  value={item.cgstPercent}
                                  onChange={(e) => handleItemChange(index, 'cgstPercent', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  type="number"
                                  value={item.sgstPercent}
                                  onChange={(e) => handleItemChange(index, 'sgstPercent', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                />
                              </td>
                              <td className="p-2">
                                <input 
                                  type="number"
                                  value={item.igstPercent}
                                  onChange={(e) => handleItemChange(index, 'igstPercent', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                />
                              </td>
                              <td className="p-2 text-right pr-6">
                                <span className="text-xs   text-slate-900">{formatCurrency(total)}</span>
                              </td>
                              <td className="p-2 text-center">
                                {poForm.items.length > 1 && (
                                  <button 
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    className="p-2 bg-slate-50 border border-slate-200 rounded  text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all active:scale-90"
                                    title="Remove Item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50/50">
                        <tr>
                          <td colSpan="8" className="px-4 p-2 text-right text-xs  text-slate-400  ">Grand Total (Incl. Taxes)</td>
                          <td className="px-4 p-2 text-right pr-6">
                            <span className="text-sm  text-indigo-600">
                              {formatCurrency(poForm.items.reduce((sum, item) => {
                                const sub = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                                const tax = sub * ((parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0) + (parseFloat(item.igstPercent) || 0)) / 100;
                                return sum + sub + tax;
                              }, 0))}
                            </span>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-slate-50 text-slate-600 rounded ">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm  text-slate-800  ">Additional Notes</h3>
                  </div>
                  <textarea 
                    value={poForm.remarks}
                    onChange={(e) => setPoForm(prev => ({ ...prev, remarks: e.target.value }))}
                    rows="4"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded  p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700 "
                    placeholder="Enter any additional remarks, special instructions, or terms..."
                  />
                </div>
              </form>
            </div>

            <div className="p-2  border-t border-slate-100 bg-slate-50/80 backdrop-blur-md flex items-center justify-between sticky bottom-0 z-10">
              <div className="hidden md:block">
                <p className="text-xs  text-slate-400  ">Mandatory Fields *</p>
                <p className="text-xs  text-slate-500  mt-1">Check all line items before submitting</p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button 
                  type="button"
                  onClick={closePoForm}
                  className="flex-1 md:flex-none p-2  rounded text-xs    text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  form="po-manual-form"
                  type="submit"
                  disabled={poFormLoading}
                  className="flex-1 md:flex-none bg-indigo-600 text-white p-2  rounded text-xs    hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {poFormLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin stroke-[3]" />
                      Processing...
                    </>
                  ) : (
                    'Confirm & Create PO'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Details Modal */}
      {viewingPo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setViewingPo(null)} />
          <div className="relative w-full max-w-5xl bg-white shadow-2xl rounded  flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
            {/* Modal Header */}
            <div className="p-4  border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded ">
                  <FileText className="w-3 h-3" />
                </div>
                <div>
                  <h2 className="text-xl  text-slate-900  flex items-center gap-3">
                    {viewingPo.po_number || 'N/A'}
                    <span className={`px-2.5 py-1 rounded-md text-xs    border ${poStatusColors[viewingPo.status || 'DRAFT'].bg} ${poStatusColors[viewingPo.status || 'DRAFT'].text} ${poStatusColors[viewingPo.status || 'DRAFT'].border}`}>
                      {viewingPo.status || 'DRAFT'}
                    </span>
                  </h2>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-semibold text-slate-700">{viewingPo.company_name || 'N/A'}</span>
                      {viewingPo.project_name && (
                        <>
                          <span className="w-1 h-1 bg-slate-300 rounded" />
                          <span className="italic text-indigo-600">{viewingPo.project_name}</span>
                        </>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {viewingPo.po_date ? new Date(viewingPo.po_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleDownloadPdf(viewingPo.id, viewingPo.po_number)}
                  className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 text-slate-700 rounded  text-xs    hover:bg-slate-100 transition-all active:scale-95 border border-slate-200 "
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button 
                  onClick={() => setViewingPo(null)}
                  className="p-2.5 rounded hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-900 active:scale-90 bg-slate-50 border border-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Project & Client Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Project Information</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-900">{viewingPo.project_name || 'General Project'}</p>
                    <p className="text-xs text-slate-500 mt-1">Reference PO: {viewingPo.po_number}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building2 className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Client Details</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-900">{viewingPo.company_name}</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {viewingPo.gstin && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">GSTIN</p>
                          <p className="text-xs font-medium text-slate-700">{viewingPo.gstin}</p>
                        </div>
                      )}
                      {viewingPo.pan && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">PAN</p>
                          <p className="text-xs font-medium text-slate-700">{viewingPo.pan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs  text-slate-400   mb-1.5">Currency</p>
                  <p className="text-sm  text-slate-700">{viewingPo.currency || 'INR'}</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs  text-slate-400   mb-1.5">Payment Terms</p>
                  <p className="text-sm  text-slate-700">{viewingPo.payment_terms || '—'}</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs  text-slate-400   mb-1.5">Credit Days</p>
                  <p className="text-sm  text-slate-700">{viewingPo.credit_days || '—'} Days</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs  text-slate-400   mb-1.5">Order Type</p>
                  <p className="text-sm  text-slate-700 uppercase">{viewingPo.order_type || 'STANDARD'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded ">
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm  text-slate-800  ">Order Items</h3>
                </div>
                
                <div className="overflow-hidden rounded border border-slate-200 bg-white ">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs  text-slate-400   text-left">Drawing No</th>
                        <th className="px-4 py-3 text-xs  text-slate-400   text-left">Description</th>
                        <th className="px-4 py-3 text-xs  text-slate-400   text-center">Qty</th>
                        <th className="px-4 py-3 text-xs  text-slate-400   text-right">Rate</th>
                        <th className="px-4 py-3 text-xs  text-slate-400   text-right pr-8">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingPo.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-xs  text-slate-900">{item.drawing_no || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs  text-slate-600">{item.description || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs  text-slate-900">{item.quantity} {item.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs  text-slate-600">{formatCurrency(item.rate)}</span>
                          </td>
                          <td className="px-4 py-3 text-right pr-8">
                            <span className="text-xs  text-slate-900">{formatCurrency(item.basic_amount)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="flex justify-end pt-6">
                <div className="w-full max-w-sm bg-slate-50/80 rounded-2xl p-6 space-y-4 border border-slate-200/50 ">
                  <div className="flex justify-between items-center text-xs  text-slate-500  ">
                    <span>Sub Total</span>
                    <span className="text-slate-900">{formatCurrency(viewingPo.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs  text-slate-500  ">
                    <span>Tax Amount</span>
                    <span className="text-slate-900">{formatCurrency(viewingPo.tax_total)}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs  text-slate-900">Net Amount</span>
                    <span className="text-xl  text-indigo-600 ">{formatCurrency(viewingPo.net_total)}</span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {viewingPo.remarks && (
                <div className="space-y-3">
                  <h4 className="text-xs  text-slate-400   ml-1">Remarks / Notes</h4>
                  <div className="bg-slate-50 rounded p-4 border border-slate-200/50 text-sm text-slate-600 italic">
                    {viewingPo.remarks}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loadingPoDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px]">
          <div className="bg-white p-2 rounded shadow-2xl flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            <p className="text-xs  text-slate-900  ">Loading Details...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerPO