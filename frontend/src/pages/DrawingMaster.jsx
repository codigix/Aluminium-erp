import React, { useState, useEffect, useCallback } from 'react';
import { Card, Modal, FormControl, DataTable, Badge } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';
import { Eye, Edit, Trash2, History, Search } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : '');

const DrawingMaster = () => {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Expanded Revisions State
  const [expandedRevisions, setExpandedRevisions] = useState({});
  const [revisionsLoading, setRevisionsLoading] = useState({});
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
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

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDrawings(searchTerm);
  };

  const [companies, setCompanies] = useState([]);

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
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    { 
      label: 'Latest Rev', 
      key: 'revision_no',
      render: (val) => (
        <Badge variant="indigo" className=" ">
          {val || '0'}
        </Badge>
      )
    },
    { 
      label: 'PO / SO Ref', 
      key: 'po_number',
      render: (val, row) => (
        <div>
          <div className="text-xs text-slate-900">{val || 'N/A'}</div>
          <div className="text-[10px] text-slate-500">SO-{String(row.sales_order_id).padStart(4, '0')}</div>
        </div>
      )
    },
    { 
      label: 'Description', 
      key: 'description',
      render: (val) => <div className="max-w-xs truncate text-slate-500">{val}</div>
    },
    { 
      label: 'Last Used', 
      key: 'last_used_at',
      render: (val) => (
        <span className="text-slate-500">
          {new Date(val).toLocaleDateString('en-IN')}
        </span>
      )
    },
    {
      label: 'Preview',
      key: 'drawing_pdf',
      render: (val, row) => val ? (
        <button 
          onClick={() => handlePreview(row)}
          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded  transition-colors mx-auto block"
          title="Preview Drawing"
        >
          <Eye className="w-5 h-5" />
        </button>
      ) : <span className="text-slate-300">—</span>
    },
    {
      label: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-center gap-2">
          <button 
            onClick={() => handleEdit(row)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded  transition-colors"
            title="Edit Drawing"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDelete(row)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded  transition-colors"
            title="Delete Drawing"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const renderExpanded = (row) => {
    fetchRevisionsIfNeeded(row.drawing_no);
    const revisions = expandedRevisions[row.drawing_no] || [];
    const isLoading = revisionsLoading[row.drawing_no];

    return (
      <div className="bg-slate-50/50 p-4 rounded  border border-slate-100 m-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs  text-slate-700   flex items-center gap-2 ">
            <History className="w-4 h-4 text-indigo-500" />
            Revision History
          </h4>
        </div>
        
        {isLoading ? (
          <div className="py-4 text-left text-xs text-slate-500 italic">Fetching revisions...</div>
        ) : revisions.length === 0 ? (
          <div className="py-4 text-left text-xs text-slate-400 italic">No previous revisions recorded</div>
        ) : (
          <div className="overflow-hidden rounded  border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2  text-lefttext-xs   text-slate-500 ">Rev</th>
                  <th className="p-2  text-lefttext-xs   text-slate-500 ">Date</th>
                  <th className="p-2  text-lefttext-xs   text-slate-500 ">Description</th>
                  <th className="p-2  text-righttext-xs   text-slate-500 ">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revisions.map((rev, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2  whitespace-nowrap text-xs    text-indigo-600">
                      {rev.revision_no || '0'}
                    </td>
                    <td className="p-2  whitespace-nowrap text-xs text-slate-600">
                      {new Date(rev.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-2  text-xs text-slate-500 max-w-xs truncate">
                      {rev.description}
                    </td>
                    <td className="p-2  text-right">
                      {rev.drawing_pdf ? (
                        <button 
                          onClick={() => handlePreview({ ...rev, drawing_no: row.drawing_no })}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors inline-block"
                          title="Preview Revision"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
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
    setModalMode(mode);
    setShowEditModal(true);
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
      setShowEditModal(false);
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
      cancelButtonColor: '#64748b'
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl text-slate-900">Drawing Master</h1>
          <p className="text-xs text-slate-500 ">Central repository for all engineering drawings and revisions</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search Drawing No, PO or Desc..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded  text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-72 transition-all "
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          </div>
          <button 
            type="submit"
            className="p-2  bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 transition-all "
          >
            Search
          </button>
          <button 
            type="button"
            onClick={() => { setSearchTerm(''); fetchDrawings(); }}
            className="p-2  bg-slate-100 text-slate-600 rounded  text-xs  hover:bg-slate-200 transition-all"
          >
            Reset
          </button>
        </form>
      </div>

      <DataTable 
        columns={columns}
        data={drawings}
        loading={loading}
        renderExpanded={renderExpanded}
      />

      <Modal
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        title={modalMode === 'view' ? 'View Drawing Details' : 'Edit Drawing'}
        size="4xl"
      >
        <form onSubmit={handleSave} className="space-y-4 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded  border border-slate-200">
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
                onChange={(e) => setEditData({...editData, contact_person: e.target.value})}
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
                onChange={(e) => setEditData({...editData, phone: e.target.value})}
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
                onChange={(e) => setEditData({...editData, email: e.target.value})}
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
                onChange={(e) => setEditData({...editData, customer_type: e.target.value})}
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
                onChange={(e) => setEditData({...editData, gstin: e.target.value})}
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
                onChange={(e) => setEditData({...editData, city: e.target.value})}
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
                onChange={(e) => setEditData({...editData, state: e.target.value})}
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
                onChange={(e) => setEditData({...editData, billing_address: e.target.value})}
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
                onChange={(e) => setEditData({...editData, shipping_address: e.target.value})}
              />
            </div>
          </div>

          {/* Drawing Details Section */}
          <div className="mt-4">
            <h3 className="text-xs  text-slate-700 mb-2">Drawing Details</h3>
            <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    onChange={(e) => setEditData({...editData, revision_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Qty</label>
                  <input 
                    type="number"
                    disabled={modalMode === 'view'}
                    className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={editData.qty}
                    onChange={(e) => setEditData({...editData, qty: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Description</label>
                <textarea 
                  disabled={modalMode === 'view'}
                  className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors min-h-[60px] resize-none ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  value={editData.description}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 mb-1">Remarks</label>
                <textarea 
                  disabled={modalMode === 'view'}
                  className={`w-full p-2 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors min-h-[60px] resize-none ${modalMode === 'view' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  value={editData.remarks}
                  onChange={(e) => setEditData({...editData, remarks: e.target.value})}
                />
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Update PDF File</label>
                  <div className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded p-4 hover:border-indigo-400 transition-colors bg-white cursor-pointer relative">
                    <input 
                      type="file" 
                      accept=".pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
                    />
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                      <p className="mt-1 text-xs text-slate-500">{editData.drawing_pdf ? editData.drawing_pdf.name : 'Click to update PDF'}</p>
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
                      handlePreview({ ...editData, drawing_pdf: editData.file_path });
                    }}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View Current PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            {modalMode === 'edit' && (
              <button
                type="submit"
                disabled={saveLoading}
                className="px-6 py-2 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-200"
              >
                {saveLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                    Save
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <DrawingPreviewModal 
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        drawing={previewDrawing}
      />
    </div>
  );
};

export default DrawingMaster;

