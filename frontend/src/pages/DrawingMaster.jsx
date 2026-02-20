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
  const [editData, setEditData] = useState({
    drawing_no: '',
    revision_no: '',
    description: '',
    drawing_pdf: null
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

  useEffect(() => {
    fetchDrawings();
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
        headers: { 'Authorization': `Bearer ${token}` },
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
        const response = await fetch(`${API_BASE}/drawings/${encodeURIComponent(drawing.drawing_no)}`, {
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
        title={`Edit Drawing: ${editData.drawing_no}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Revision No">
              <input 
                type="text" 
                className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={editData.revision_no}
                onChange={(e) => setEditData({...editData, revision_no: e.target.value})}
              />
            </FormControl>
          </div>
          <FormControl label="Description">
            <textarea 
              className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] transition-all"
              value={editData.description}
              onChange={(e) => setEditData({...editData, description: e.target.value})}
            />
          </FormControl>
          <FormControl label="Upload PDF">
            <input 
              type="file" 
              accept=".pdf"
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded  file:border-0 file:text-sm file: file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
              onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
            />
          </FormControl>
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setShowEditModal(false)}
              className="p-2.5 border border-slate-200 text-slate-600 rounded  text-xs  hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saveLoading}
              className="px-10 py-2.5 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
            >
              {saveLoading ? 'Saving...' : 'Save Changes'}
            </button>
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

