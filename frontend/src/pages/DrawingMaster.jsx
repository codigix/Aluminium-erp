import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, Modal, FormControl, DataTable, StatusBadge } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye, Edit2, Trash2, History, Search, RefreshCw, FileText, PencilLine, Plus, X, ChevronRight, ChevronDown, Check, ChevronUp } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DrawingMaster = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const isEditPath = location.pathname.includes('/drawing-master/edit');
    const id = searchParams.get('id');

    if (isEditPath && id && drawings.length > 0) {
      const drawing = drawings.find(d => String(d.drawing_master_id) === String(id));
      if (drawing) {
        if (!showEditForm || String(editData.id) !== String(id)) {
          handleEdit(drawing);
        }
      }
    } else if (!isEditPath && showEditForm) {
      setShowEditForm(false);
    }
  }, [location.pathname, searchParams, drawings]);
  
  // Expanded Revisions State
  const [expandedRevisions, setExpandedRevisions] = useState({});
  const [revisionsLoading, setRevisionsLoading] = useState({});
  
  // Edit Modal State
  const [showEditForm, setShowEditForm] = useState(false);
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
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());

  const handlePreview = (drawing) => {
    setPreviewDrawing(drawing);
    setShowPreviewModal(true);
  };

  const fetchDrawings = async (search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      params.append('onlyShared', 'true');
      if (search) params.append('search', search);
      
      const url = `${API_BASE}/drawings?${params.toString()}`;
        
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch drawings');
      const data = await response.json();
      setDrawings(data);
    } catch (error) {
      console.error(error);
      errorToast('Failed to load drawing master');
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
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDrawings();
    fetchCompanies();
  }, []);

  const fetchRevisions = async (drawingNo) => {
    try {
      setRevisionsLoading(prev => ({ ...prev, [drawingNo]: true }));
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${encodeURIComponent(drawingNo)}/revisions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch revisions');
      const data = await response.json();
      setExpandedRevisions(prev => ({ ...prev, [drawingNo]: data }));
    } catch (error) {
      console.error(error);
    } finally {
      setRevisionsLoading(prev => ({ ...prev, [drawingNo]: false }));
    }
  };

  const fetchRevisionsIfNeeded = useCallback((drawingNo) => {
    if (!expandedRevisions[drawingNo] && !revisionsLoading[drawingNo]) {
      fetchRevisions(drawingNo);
    }
  }, [expandedRevisions, revisionsLoading]);

  const handleApproveItem = async (itemId) => {
    try {
      setBulkOperationLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/items/${itemId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });

      if (!response.ok) throw new Error('Failed to approve drawing');

      successToast('Drawing approved');
      fetchDrawings(searchTerm);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleRejectItem = async (itemId) => {
    const { value: reason } = await Swal.fire({
      title: '<span class="text-base font-bold text-slate-800">Reject Drawing</span>',
      input: 'textarea',
      inputPlaceholder: 'Enter reason for rejection here...',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel',
      width: '400px',
      padding: '1.25rem',
      customClass: {
        confirmButton: 'text-[11px] font-bold px-4 py-2 rounded shadow-lg shadow-rose-100 uppercase tracking-wider',
        cancelButton: 'text-[11px] font-bold px-4 py-2 rounded uppercase tracking-wider',
        input: 'text-xs'
      }
    });

    if (reason) {
      try {
        setBulkOperationLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/items/${itemId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'REJECTED', reason: reason })
        });

        if (!response.ok) throw new Error('Failed to reject drawing');

        successToast('Drawing marked as rejected');
        fetchDrawings(searchTerm);
      } catch (error) {
        errorToast(error.message);
      } finally {
        setBulkOperationLoading(false);
      }
    }
  };

  const handleApproveGroup = async () => {
    const selectedIds = Array.from(selectedRows);
    if (selectedIds.length === 0) return;

    // Filter drawings to get only those that are pending and get their sales_order_item_id
    const itemsToApprove = drawings
      .filter(d => selectedIds.includes(d.drawing_master_id))
      .filter(d => {
        const status = (d.item_status || '').trim().toUpperCase();
        return d.sales_order_item_id && status !== 'APPROVED' && status !== 'REJECTED';
      })
      .map(d => d.sales_order_item_id);

    if (itemsToApprove.length === 0) {
      errorToast('No pending items selected for approval');
      return;
    }

    const result = await Swal.fire({
        title: '<span class="text-base font-bold text-slate-800">Approve Selected Drawings?</span>',
        html: `<p class="text-xs text-slate-500">You are about to approve <b>${itemsToApprove.length}</b> drawings. They will be sent to BOM creation.</p>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Yes, Approve All',
        cancelButtonText: 'Cancel',
        width: '350px',
        padding: '1.25rem',
        customClass: {
          confirmButton: 'text-[10px] font-bold px-4 py-2 rounded shadow-lg shadow-emerald-100 uppercase tracking-wider',
          cancelButton: 'text-[10px] font-bold px-4 py-2 rounded uppercase tracking-wider',
          title: 'mt-2'
        }
    });

    if (!result.isConfirmed) return;

    try {
      setBulkOperationLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/bulk/items/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemIds: itemsToApprove, status: 'Approved' })
      });

      if (!response.ok) throw new Error('Failed to approve drawings');

      successToast(`${itemsToApprove.length} drawings approved successfully`);
      setSelectedRows(new Set());
      fetchDrawings(searchTerm);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const columns = [
    { 
      label: 'Drawing No', 
      key: 'drawing_no',
      sortable: true,
      className: ' text-indigo-600'
    },
    { 
      label: 'Description', 
      key: 'drawing_description',
      sortable: true,
      render: (val, row) => <div className="max-w-xs truncate text-slate-600 font-medium">{val || row.item_description || '—'}</div>
    },
    { 
      label: 'Client / Ref', 
      key: 'client_name',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-900 text-sm">{val}</span>
          <span className="text-xs text-slate-500   ">SO-{String(row.sales_order_id || 0).padStart(4, '0')}</span>
        </div>
      )
    },
    { 
      label: 'Last Updated', 
      key: 'updated_at',
      render: (val) => (
        <span className="text-slate-500 text-xs font-medium">
          {new Date(val || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      )
    },
    {
      label: 'Status',
      key: 'status',
      render: (val, row) => {
        const status = (row.item_status || '').trim().toUpperCase();
        if (status === 'APPROVED') {
          return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200 uppercase">Approved</span>;
        } else if (status === 'REJECTED') {
          return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold border border-rose-200 uppercase">Rejected</span>;
        } else if (row.sales_order_item_id) {
          return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold border border-amber-200 uppercase whitespace-nowrap">⏳ Pending</span>;
        }
        return <span className="text-slate-300">—</span>;
      }
    },
    {
      label: 'Preview',
      key: 'drawing_pdf',
      className: 'text-center',
      render: (val, row) => (val || row.file_path) ? (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handlePreview(row);
          }}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded  transition-all"
          title="Preview Drawing"
        >
          <Eye size={15} />
        </button>
      ) : <span className="text-slate-300">—</span>
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => {
        const status = (row.item_status || '').trim().toUpperCase();
        const isPending = row.sales_order_item_id && status !== 'APPROVED' && status !== 'REJECTED';
        
        return (
          <div className="flex justify-end gap-2">
            {isPending && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApproveItem(row.sales_order_item_id);
                  }}
                  disabled={bulkOperationLoading}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded transition-all border border-transparent hover:border-emerald-100"
                  title="Approve Drawing"
                >
                  <Check size={15} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectItem(row.sales_order_item_id);
                  }}
                  disabled={bulkOperationLoading}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded transition-all border border-transparent hover:border-rose-100"
                  title="Reject Drawing"
                >
                  <X size={15} />
                </button>
              </>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const drawingNo = row.drawing_no;
                const isExpanded = !!expandedRevisions[drawingNo];
                if (isExpanded) {
                  setExpandedRevisions(prev => {
                    const next = { ...prev };
                    delete next[drawingNo];
                    return next;
                  });
                } else {
                  fetchRevisionsIfNeeded(drawingNo);
                }
                
                // Toggle the DataTable row expansion
                if (window.toggleDataTableRow) {
                   // Find row index in drawings array
                   const rowIdx = drawings.findIndex(d => d.drawing_master_id === row.drawing_master_id);
                   window.toggleDataTableRow(row.drawing_master_id || rowIdx);
                }
              }}
              className={`flex items-center gap-1 p-1.5 px-2 rounded transition-all ${expandedRevisions[row.drawing_no] ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
              title="Revision History"
            >
              <History size={14} />
              {expandedRevisions[row.drawing_no] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/drawing-master/edit?id=${row.drawing_master_id}`);
            }}
            className="p-2 text-amber-500 hover:bg-amber-50 rounded  transition-all border border-transparent hover:border-amber-100"
            title="Edit Drawing"
          >
            <Edit2 size={15} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded  transition-all border border-transparent hover:border-rose-100"
            title="Delete Drawing"
          >
            <Trash2 size={15} />
          </button>
        </div>
        );
      }
    }
  ];

  const handleEdit = (drawing) => {
    const company = companies.find(c => c.company_name === drawing.client_name);
    
    let billingAddressLine = '';
    let shippingAddressLine = '';
    
    if (company) {
      const billingAddress = company.addresses?.find(a => a.address_type === 'BILLING');
      const shippingAddress = company.addresses?.find(a => a.address_type === 'SHIPPING');
      billingAddressLine = billingAddress ? `${billingAddress.line1}${billingAddress.line2 ? ', ' + billingAddress.line2 : ''}, ${billingAddress.city}, ${billingAddress.state} ${billingAddress.pincode}` : '';
      shippingAddressLine = shippingAddress ? `${shippingAddress.line1}${shippingAddress.line2 ? ', ' + shippingAddress.line2 : ''}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}` : '';
    }

    setEditData({
      id: drawing.drawing_master_id,
      drawing_no: drawing.drawing_no,
      revision_no: drawing.revision || drawing.revision_no || '0',
      description: drawing.description || '',
      client_name: drawing.client_name,
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
    });
    if (!location.pathname.includes('/drawing-master/edit')) {
      navigate(`/drawing-master/edit?id=${drawing.drawing_master_id}`);
    }
    setShowEditForm(true);
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
      
      successToast('Drawing updated successfully');
      navigate('/drawing-master');
      fetchDrawings();
      setExpandedRevisions(prev => {
        const next = { ...prev };
        delete next[editData.drawing_no];
        return next;
      });
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (drawing) => {
    const result = await Swal.fire({
      title: 'Delete Drawing?',
      text: `Are you sure you want to delete drawing: ${drawing.drawing_no}? This will delete all revision history.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      customClass: {
        popup: 'rounded border border-slate-100',
        confirmButton: 'rounded   px-6 py-2.5 shadow-lg shadow-rose-100',
        cancelButton: 'rounded   px-6 py-2.5'
      }
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/drawings/${drawing.drawing_master_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete drawing');
        successToast('Drawing has been deleted');
        fetchDrawings();
      } catch (error) {
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className=" space-y-2  animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          
          <div>
            <h1 className="text-xl  text-slate-900 ">Drawing Master</h1>
            <p className="text-xs text-slate-500 ">Central repository for all engineering drawings and revisions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
            onClick={() => fetchDrawings()}
            className="p-2.5 text-slate-500 hover:bg-slate-50 rounded  transition-all border border-slate-200"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!showEditForm ? (
        <Card className="">
          <div className="p-2 border-b border-slate-50 flex items-center justify-between">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={15} />
              <input 
                type="text"
                placeholder="Search by Drawing No, Client or Description..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value === '') fetchDrawings();
                }}
                onKeyDown={(e) => e.key === 'Enter' && fetchDrawings(searchTerm)}
              />
            </div>
            {selectedRows.size > 0 && drawings.some(d => selectedRows.has(d.id) && (d.item_status || '').trim().toUpperCase() !== 'APPROVED' && (d.item_status || '').trim().toUpperCase() !== 'REJECTED') && (
              <button
                onClick={handleApproveGroup}
                disabled={bulkOperationLoading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-50 disabled:opacity-50 border-none ml-2"
              >
                {bulkOperationLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                Approve Selective ({drawings.filter(d => selectedRows.has(d.id) && (d.item_status || '').trim().toUpperCase() !== 'APPROVED' && (d.item_status || '').trim().toUpperCase() !== 'REJECTED').length})
              </button>
           )}
          </div>
          <div className="p-2">
            <DataTable 
              columns={columns}
              data={drawings}
              loading={loading}
              pageSize={5}
              rowId="drawing_master_id"
              hideHeader={true}
              hideExpander={true}
              disableRowClickExpansion={true}
              selectable={true}
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
              renderExpanded={(row) => {
                const revisions = expandedRevisions[row.drawing_no] || [];
                const isRevLoading = revisionsLoading[row.drawing_no];
                
                return (
                  <div className="bg-slate-200 p-2 rounded border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <History size={15} />
                        <h4 className="text-sm   ">Revision History</h4>
                      </div>
                      <span className="p-1 bg-white border border-slate-200 rounded  text-xs  text-slate-500 shadow-sm">
                        {revisions.length} REVISIONS FOUND
                      </span>
                    </div>

                    {isRevLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-slate-400 italic text-sm">
                        <RefreshCw size={15} className="animate-spin" />
                        Fetching revisions...
                      </div>
                    ) : revisions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <FileText size={32} className="opacity-20" />
                        <p className="text-sm italic">No previous revisions recorded for this drawing</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded  border border-slate-200 bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 text-left">
                          <thead className="bg-slate-50/80">
                            <tr>
                              <th className="px-4 p-2 text-xs  text-slate-500  ">Rev No</th>
                              <th className="px-4 p-2 text-xs  text-slate-500  ">Date</th>
                              <th className="px-4 p-2 text-xs  text-slate-500  ">Description</th>
                              <th className="px-4 p-2 text-xs  text-slate-500   text-right">View</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {revisions.map((rev, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="p-2 text-xs  text-indigo-600">
                                  {rev.revision_no || '0'}
                                </td>
                                <td className="px-4 p-2 text-xs text-slate-500 font-medium">
                                  {new Date(rev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="p-2 text-xs text-slate-600 max-w-md truncate">
                                  {rev.description || 'No description provided'}
                                </td>
                                <td className="px-4 p-2 text-right">
                                  {rev.drawing_pdf ? (
                                    <button 
                                      onClick={() => handlePreview({ ...rev, drawing_no: row.drawing_no })}
                                      className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded  transition-all opacity-0 group-hover:opacity-100"
                                      title="Preview Revision"
                                    >
                                      <Eye size={15} />
                                    </button>
                                  ) : <span className="text-slate-300 text-xs">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </Card>
      ) : (
        <Card className=" animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-2 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded ">
                        <Edit2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-md  text-slate-900">Edit Drawing Details</h2>
                        <p className="text-xs text-slate-500 font-medium">Update metadata for {editData.drawing_no}</p>
                    </div>
                </div>
                <button 
                    onClick={() => navigate('/drawing-master')}
                    className="p-2 text-slate-400 hover:bg-white hover:text-slate-600 rounded  transition-all border border-transparent hover:border-slate-200"
                >
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={handleSave} className="p-2 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Drawing No</label>
                        <input 
                            type="text"
                            readOnly
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs  text-slate-400 outline-none"
                            value={editData.drawing_no}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Current Revision</label>
                        <input 
                            type="text"
                            readOnly
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs  text-slate-400 outline-none"
                            value={editData.revision_no}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Description</label>
                        <input 
                            type="text"
                            className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Enter description"
                            value={editData.description}
                            onChange={(e) => setEditData({...editData, description: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Client Name</label>
                        <input 
                            type="text"
                            readOnly
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs  text-slate-400 outline-none"
                            value={editData.client_name}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Drawing File (Optional Update)</label>
                        <input 
                            type="file"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs file:mr-4 file:py-1 file:px-3 file:rounded  file:border-0 file:text-xs file: file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer"
                            onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
                            accept=".pdf"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs  text-slate-500  ">Quantity</label>
                        <input 
                            type="number"
                            className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={editData.qty}
                            onChange={(e) => setEditData({...editData, qty: parseInt(e.target.value) || 0})}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs  text-slate-500  ">Remarks</label>
                    <textarea 
                        className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24"
                        placeholder="Add internal remarks here..."
                        value={editData.remarks}
                        onChange={(e) => setEditData({...editData, remarks: e.target.value})}
                    ></textarea>
                </div>
                
                <div className="pt-6 border-t border-slate-50 flex justify-end gap-2">
                    <button 
                        type="button" 
                        onClick={() => navigate('/drawing-master')}
                        className="p-2 bg-white border border-slate-200 text-slate-600 rounded text-xs  hover:bg-slate-50 transition-all"
                    >
                        Discard Changes
                    </button>
                    <button 
                        type="submit" 
                        disabled={saveLoading}
                        className="p-2 bg-indigo-600 text-white rounded text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                    >
                        {saveLoading ? 'Saving...' : 'Update Master Record'}
                    </button>
                </div>
            </form>
        </Card>
      )}

      {showPreviewModal && previewDrawing && (
        <DrawingPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          drawing={previewDrawing}
        />
      )}
    </div>
  );
};

export default DrawingMaster;