import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const CustomerDrawing = () => {
  const [drawings, setDrawings] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadMode, setUploadMode] = useState('bulk'); // 'bulk' or 'manual'
  const [clientLocked, setClientLocked] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const [clientFilter, setClientFilter] = useState('ALL');
  
  // Revisions Modal State
  const [showRevisions, setShowRevisions] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    drawing_no: '',
    revision_no: '',
    description: '',
    drawing_pdf: null
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchDrawings = async (search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const url = search 
        ? `${API_BASE}/drawings?search=${encodeURIComponent(search)}`
        : `${API_BASE}/drawings`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch drawings');
      const data = await response.json();
      setDrawings(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load customer drawings', 'error');
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
      console.error('Fetch companies error:', error);
    }
  };

  const toggleClientGroup = (clientName) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  const groupedDrawings = drawings.reduce((acc, drawing) => {
    const client = drawing.client_name || 'Unassigned';
    if (clientFilter !== 'ALL' && client !== clientFilter) return acc;
    if (!acc[client]) acc[client] = [];
    acc[client].push(drawing);
    return acc;
  }, {});

  useEffect(() => {
    fetchDrawings();
    fetchCompanies();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDrawings(searchTerm);
  };

  const handleViewRevisions = async (drawing) => {
    try {
      setSelectedDrawing(drawing);
      setShowRevisions(true);
      setRevisionsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings/${encodeURIComponent(drawing.drawing_no)}/revisions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch revisions');
      const data = await response.json();
      setRevisions(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load revisions', 'error');
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleEdit = (drawing) => {
    setEditData({
      drawing_no: drawing.drawing_no,
      revision_no: drawing.revision_no || '0',
      description: drawing.description || '',
      drawing_pdf: null
    });
    setShowEditModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaveLoading(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('revisionNo', editData.revision_no);
      formData.append('description', editData.description);
      if (editData.drawing_pdf) {
        formData.append('drawing_pdf', editData.drawing_pdf);
      }

      const response = await fetch(`${API_BASE}/drawings/${encodeURIComponent(editData.drawing_no)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update drawing');
      
      Swal.fire('Success', 'Customer drawing updated successfully', 'success');
      setShowEditModal(false);
      fetchDrawings(searchTerm);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  // New Form State
  const [newDrawing, setNewDrawing] = useState({
    client_name: '',
    drawing_no: '',
    revision: '',
    qty: 1,
    description: '',
    file: null,
    file_type: '',
    remarks: ''
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toUpperCase();
      setNewDrawing({
        ...newDrawing,
        file: file,
        file_type: ext
      });
    }
  };

  const handleAddDrawing = async (e) => {
    e.preventDefault();
    const isExcel = newDrawing.file_type === 'XLSX' || newDrawing.file_type === 'XLS';
    
    if (!newDrawing.file) {
      return Swal.fire('Missing Info', 'Drawing File is mandatory', 'warning');
    }
    
    if (!isExcel && !newDrawing.drawing_no) {
      return Swal.fire('Missing Info', 'Drawing Number is mandatory for non-Excel files', 'warning');
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('clientName', newDrawing.client_name);
      formData.append('drawingNo', newDrawing.drawing_no || (newDrawing.file ? newDrawing.file.name : 'BATCH_IMPORT'));
      formData.append('revision', newDrawing.revision);
      formData.append('qty', newDrawing.qty);
      formData.append('description', newDrawing.description);
      formData.append('remarks', newDrawing.remarks);
      formData.append('fileType', newDrawing.file_type);
      formData.append('file', newDrawing.file);

      const response = await fetch(`${API_BASE}/drawings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      Swal.fire('Success', uploadMode === 'bulk' ? 'Excel drawings imported successfully' : 'Drawing added successfully', 'success');
      
      // If manual mode, keep the client but clear drawing details
      if (uploadMode === 'manual') {
        setNewDrawing(prev => ({
          ...prev,
          drawing_no: '',
          revision: '',
          qty: 1,
          description: '',
          file: null,
          file_type: '',
          remarks: ''
        }));
        setClientLocked(true);
      } else {
        // If bulk mode, clear everything
        setNewDrawing({
          client_name: '',
          drawing_no: '',
          revision: '',
          qty: 1,
          description: '',
          file: null,
          file_type: '',
          remarks: ''
        });
        setClientLocked(false);
      }
      
      fetchDrawings();
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
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
        const response = await fetch(`${API_BASE}/drawings/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Delete failed');
        Swal.fire('Deleted!', 'Drawing has been deleted.', 'success');
        fetchDrawings();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  return (
    <div className="p-6">
      {/* SECTION 4: SYSTEM LABEL */}
      <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded shadow-sm">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-amber-800 font-bold">
              ⚠️ Customer drawings are for reference only. Final production drawings will be created by Engineering.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Drawing Master</h1>
          <p className="text-sm text-slate-500">View and manage drawings provided by customers across all orders</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search Drawing, Client, PO or Desc..." 
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
          <button 
            type="button"
            onClick={() => { setSearchTerm(''); fetchDrawings(); }}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
          >
            Reset
          </button>
        </form>
      </div>

      {/* SECTION 2: ADD CUSTOMER DRAWING (FORM) */}
      <Card className="mb-8 overflow-hidden border-indigo-100 border-2">
        <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">➕</span>
              Add Customer Drawing
            </h2>
            <div className="flex bg-white p-1 rounded-lg border border-indigo-100">
              <button 
                onClick={() => setUploadMode('bulk')}
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${uploadMode === 'bulk' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                Bulk Upload (Excel)
              </button>
              <button 
                onClick={() => setUploadMode('manual')}
                className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${uploadMode === 'manual' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                Manual Entry
              </button>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-500 uppercase">
            Mode: {uploadMode === 'bulk' ? '🚀 Bulk Import' : '📝 Single Entry'}
          </span>
        </div>
        
        <form onSubmit={handleAddDrawing} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Name <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select 
                  required
                  disabled={clientLocked}
                  className={`w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${clientLocked ? 'bg-slate-50 cursor-not-allowed text-slate-500 font-bold' : ''}`}
                  value={newDrawing.client_name}
                  onChange={(e) => setNewDrawing({...newDrawing, client_name: e.target.value})}
                >
                  <option value="">Select Client</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.company_name}>{company.company_name}</option>
                  ))}
                </select>
                {clientLocked && (
                  <button 
                    type="button"
                    onClick={() => setClientLocked(false)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100 transition-colors"
                    title="Change Client"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>

            {/* CONDITIONAL FIELDS BASED ON MODE */}
            {uploadMode === 'manual' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client Drawing Number <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. DRW-1001"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newDrawing.drawing_no}
                    onChange={(e) => setNewDrawing({...newDrawing, drawing_no: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Drawing Description</label>
                  <input 
                    type="text" 
                    placeholder="Brief description of the drawing"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newDrawing.description}
                    onChange={(e) => setNewDrawing({...newDrawing, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Revision</label>
                  <input 
                    type="text" 
                    placeholder="e.g. A, B, 0"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newDrawing.revision}
                    onChange={(e) => setNewDrawing({...newDrawing, revision: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qty</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newDrawing.qty}
                    onChange={(e) => setNewDrawing({...newDrawing, qty: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload Drawing File <span className="text-red-500">*</span></label>
                  <input 
                    type="file" 
                    required
                    accept=".pdf,.dwg,.step,.stp"
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remarks</label>
                  <textarea 
                    rows="1"
                    placeholder="Any clarifications..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    value={newDrawing.remarks}
                    onChange={(e) => setNewDrawing({...newDrawing, remarks: e.target.value})}
                  />
                </div>
              </>
            ) : (
              /* BULK MODE */
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload Excel (.xlsx/.xls) <span className="text-red-500">*</span></label>
                  <input 
                    type="file" 
                    required
                    accept=".xlsx,.xls"
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={handleFileChange}
                  />
                  {newDrawing.file && (newDrawing.file_type === 'XLSX' || newDrawing.file_type === 'XLS') && (
                    <p className="mt-1 text-[10px] text-emerald-600 font-bold italic">✅ Ready to import rows from: {newDrawing.file.name}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 italic text-slate-400">Excel Import Logic</label>
                  <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-[10px] text-slate-500">System will automatically extract <span className="font-bold">Drawing No, Revision, and Description</span> from the uploaded file.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end border-t pt-6">
            <button 
              type="button"
              onClick={() => {
                setNewDrawing({ client_name: '', drawing_no: '', revision: '', qty: 1, description: '', file: null, file_type: '', remarks: '' });
                setClientLocked(false);
              }}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Reset All
            </button>
            <button 
              type="submit"
              disabled={loading}
              className={`px-8 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Processing...' : uploadMode === 'bulk' ? 'Upload & Import' : 'Add Drawing'}
            </button>
          </div>
        </form>
      </Card>

      {/* SECTION 3: CUSTOMER DRAWINGS TABLE */}
      <Card>
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            📋 Drawing List (Grouped by Client)
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Filter:</span>
            <select 
              className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="ALL">ALL CLIENTS</option>
              {Object.keys(drawings.reduce((acc, d) => {
                if (d.client_name) acc[d.client_name] = true;
                return acc;
              }, {})).sort().map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
            <button 
              onClick={() => {
                const allExpanded = Object.keys(groupedDrawings).reduce((acc, client) => {
                  acc[client] = true;
                  return acc;
                }, {});
                setExpandedClients(allExpanded);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              EXPAND ALL
            </button>
            <button 
              onClick={() => setExpandedClients({})}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              COLLAPSE ALL
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto p-4 bg-slate-50/50">
          {loading ? (
            <div className="py-12 text-center text-slate-500 italic font-medium">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                Loading drawing records...
              </div>
            </div>
          ) : Object.keys(groupedDrawings).length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic">No drawings found matching your criteria</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedDrawings).map(([clientName, clientDrawings]) => (
                <div key={clientName} className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm transition-all hover:shadow-md">
                  {/* CLIENT GROUP HEADER */}
                  <div 
                    onClick={() => toggleClientGroup(clientName)}
                    className={`px-6 py-4 cursor-pointer flex justify-between items-center transition-all ${expandedClients[clientName] ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-1 rounded bg-slate-100 transition-transform duration-200 ${expandedClients[clientName] ? 'rotate-90' : ''}`}>
                        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-indigo-900 uppercase tracking-tight">{clientName}</span>
                        <span className="text-[10px] font-bold text-slate-400">CUSTOMER GROUP</span>
                      </div>
                      <span className="ml-2 px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black border border-indigo-200">
                        {clientDrawings.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">
                        {expandedClients[clientName] ? 'Click to collapse' : 'Click to expand'}
                      </span>
                    </div>
                  </div>

                  {/* DRAWINGS TABLE (ACCORDION CONTENT) */}
                  {expandedClients[clientName] && (
                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                          <tr>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Sr</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Drawing No</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Rev</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Qty</th>
                            <th className="px-6 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider">File</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">Uploaded By</th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                          {clientDrawings.map((drawing, idx) => (
                            <tr key={drawing.id || `${drawing.drawing_no}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-3 whitespace-nowrap text-[10px] text-slate-400 font-mono font-bold">{idx + 1}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-slate-900">{drawing.drawing_no}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500 font-medium">
                                {drawing.description || <span className="text-slate-300 italic">No description</span>}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-xs">
                                <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[10px] font-bold border border-slate-200">
                                  {drawing.revision || drawing.revision_no || '0'}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-indigo-600">
                                {drawing.qty || 1}
                              </td>
                              <td className="px-6 py-3 text-center">
                                {(drawing.file_path || drawing.drawing_pdf) ? (
                                  <a 
                                    href={`${API_BASE.replace('/api', '')}/${drawing.file_path || drawing.drawing_pdf}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    VIEW
                                  </a>
                                ) : (
                                  <span className="text-slate-300 text-[10px] font-bold">MISSING</span>
                                )}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-100">
                                  {drawing.file_type || 'PDF'}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                    {(drawing.uploaded_by || 'S')[0]}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600">{drawing.uploaded_by || 'Sales'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-right space-x-2">
                                <button 
                                  onClick={() => handleViewRevisions(drawing)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Revisions"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                </button>
                                <button 
                                  onClick={() => handleDelete(drawing.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900 opacity-75" onClick={() => setShowEditModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Edit Drawing: {editData.drawing_no}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Revision No</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.revision_no}
                    onChange={(e) => setEditData({...editData, revision_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                    value={editData.description}
                    onChange={(e) => setEditData({...editData, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload PDF</label>
                  <input 
                    type="file" 
                    accept=".pdf"
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saveLoading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saveLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Revisions Modal */}
      {showRevisions && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900 opacity-75" onClick={() => setShowRevisions(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Revision History: {selectedDrawing?.drawing_no}</h3>
                <button onClick={() => setShowRevisions(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {revisionsLoading ? (
                <div className="py-12 text-center text-slate-500 italic">Fetching revisions...</div>
              ) : (
                <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Rev</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">File</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Order</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {revisions.map((rev, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-indigo-600">{rev.revision_no || '0'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {new Date(rev.created_at).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{rev.description}</td>
                          <td className="px-6 py-4 text-center">
                            {rev.drawing_pdf ? (
                              <a 
                                href={`${API_BASE.replace('/api', '')}/${rev.drawing_pdf}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-xs font-bold text-slate-900">{rev.po_number || 'N/A'}</div>
                            <div className="text-[10px] text-slate-500">SO-{String(rev.sales_order_id).padStart(4, '0')}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDrawing;
