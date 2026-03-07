import React, { useState, useEffect, useCallback } from 'react';
import { Card, Modal, FormControl, DataTable, StatusBadge } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye, Edit2, Trash2, History, Search, RefreshCw, FileText, PencilLine, Plus, X, ChevronRight, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast, infoToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DrawingMaster = () => {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Expanded Revisions State
  const [expandedRevisions, setExpandedRevisions] = useState({});
  const [revisionsLoading, setRevisionsLoading] = useState({});
  
  // Edit Modal State
  const [showEditForm, setShowEditForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
  
  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState(null);
  const [companies, setCompanies] = useState([]);

  const handlePreview = (drawing) => {
    setPreviewDrawing(drawing);
    setShowPreviewModal(true);
  };

  const fetchDrawings = async (search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const url = search 
        ? `${API_BASE}/drawings?search=${encodeURIComponent(search)}`
        : `${API_BASE}/drawings`;
        
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

  const columns = [
    { 
      label: 'Drawing No', 
      key: 'drawing_no',
      sortable: true,
      className: 'font-bold text-indigo-600'
    },
    { 
      label: 'Description', 
      key: 'description',
      sortable: true,
      render: (val) => <div className="max-w-xs truncate text-slate-600 font-medium">{val || '—'}</div>
    },
    { 
      label: 'Client / Ref', 
      key: 'client_name',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="text-slate-900 font-medium text-sm">{val}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">SO-{String(row.sales_order_id || 0).padStart(4, '0')}</span>
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
      label: 'Preview',
      key: 'drawing_pdf',
      className: 'text-center',
      render: (val, row) => (val || row.file_path) ? (
        <button 
          onClick={() => handlePreview(row)}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          title="Preview Drawing"
        >
          <Eye size={18} />
        </button>
      ) : <span className="text-slate-300">—</span>
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => {
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
            }}
            className={`p-2 rounded-xl transition-all ${expandedRevisions[row.drawing_no] ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
            title="Revision History"
          >
            <History size={16} />
          </button>
          <button 
            onClick={() => handleEdit(row)}
            className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-all border border-transparent hover:border-amber-100"
            title="Edit Drawing"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={() => handleDelete(row)}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
            title="Delete Drawing"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
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
      id: drawing.id,
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
    setIsEditing(true);
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
      setShowEditForm(false);
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
        popup: 'rounded-2xl border border-slate-100',
        confirmButton: 'rounded-xl font-bold px-6 py-2.5 shadow-lg shadow-rose-100',
        cancelButton: 'rounded-xl font-bold px-6 py-2.5'
      }
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/drawings/${drawing.id}`, {
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
    <div className="p-4 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
            <PencilLine size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Drawing Master</h1>
            <p className="text-sm text-slate-500 font-medium">Central repository for all engineering drawings and revisions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
            onClick={() => fetchDrawings()}
            className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-slate-200"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!showEditForm ? (
        <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text"
                placeholder="Search by Drawing No, Client or Description..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value === '') fetchDrawings();
                }}
                onKeyDown={(e) => e.key === 'Enter' && fetchDrawings(searchTerm)}
              />
            </div>
          </div>
          <div className="p-2">
            <DataTable 
              columns={columns}
              data={drawings}
              loading={loading}
              hideHeader={true}
              hideExpander={true}
              renderExpanded={(row) => {
                const revisions = expandedRevisions[row.drawing_no] || [];
                const isRevLoading = revisionsLoading[row.drawing_no];
                
                return (
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 m-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <History size={18} />
                        <h4 className="text-sm font-bold uppercase tracking-wider">Revision History</h4>
                      </div>
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 shadow-sm">
                        {revisions.length} REVISIONS FOUND
                      </span>
                    </div>

                    {isRevLoading ? (
                      <div className="flex items-center justify-center py-8 gap-3 text-slate-400 italic text-sm">
                        <RefreshCw size={16} className="animate-spin" />
                        Fetching revisions...
                      </div>
                    ) : revisions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <FileText size={32} className="opacity-20" />
                        <p className="text-sm italic">No previous revisions recorded for this drawing</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 text-left">
                          <thead className="bg-slate-50/80">
                            <tr>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rev No</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">View</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {revisions.map((rev, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-4 py-3 text-sm font-bold text-indigo-600">
                                  {rev.revision_no || '0'}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                                  {new Date(rev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 max-w-md truncate">
                                  {rev.description || 'No description provided'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {rev.drawing_pdf ? (
                                    <button 
                                      onClick={() => handlePreview({ ...rev, drawing_no: row.drawing_no })}
                                      className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                      title="Preview Revision"
                                    >
                                      <Eye size={16} />
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
        <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                        <Edit2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Edit Drawing Details</h2>
                        <p className="text-xs text-slate-500 font-medium">Update metadata for {editData.drawing_no}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowEditForm(false)}
                    className="p-2 text-slate-400 hover:bg-white hover:text-slate-600 rounded-xl transition-all border border-transparent hover:border-slate-200"
                >
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drawing No</label>
                        <input 
                            type="text"
                            readOnly
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 outline-none"
                            value={editData.drawing_no}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Revision</label>
                        <input 
                            type="text"
                            readOnly
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 outline-none"
                            value={editData.revision_no}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                        <input 
                            type="text"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Enter description"
                            value={editData.description}
                            onChange={(e) => setEditData({...editData, description: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name</label>
                        <input 
                            type="text"
                            readOnly
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 outline-none"
                            value={editData.client_name}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drawing File (Optional Update)</label>
                        <input 
                            type="file"
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer"
                            onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
                            accept=".pdf"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</label>
                        <input 
                            type="number"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={editData.qty}
                            onChange={(e) => setEditData({...editData, qty: parseInt(e.target.value) || 0})}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                    <textarea 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24"
                        placeholder="Add internal remarks here..."
                        value={editData.remarks}
                        onChange={(e) => setEditData({...editData, remarks: e.target.value})}
                    ></textarea>
                </div>
                
                <div className="pt-6 border-t border-slate-50 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={() => setShowEditForm(false)}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                    >
                        Discard Changes
                    </button>
                    <button 
                        type="submit" 
                        disabled={saveLoading}
                        className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
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
