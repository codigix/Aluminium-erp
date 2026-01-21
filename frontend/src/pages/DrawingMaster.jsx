import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const DrawingMaster = () => {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
      Swal.fire('Error', 'Failed to load drawing master', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrawings();
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
      
      Swal.fire('Success', 'Drawing updated successfully', 'success');
      setShowEditModal(false);
      fetchDrawings(searchTerm);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (drawing) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete drawing: ${drawing.drawing_no}. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
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
        Swal.fire('Deleted!', 'Drawing has been deleted successfully', 'success');
        fetchDrawings(searchTerm);
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
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
          <p className="text-xs text-slate-500">Central repository for all engineering drawings and revisions</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search Drawing No, PO or Desc..." 
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            type="submit"
            className="p-2 bg-indigo-600 text-white rounded-md text-xs  hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
          <button 
            type="button"
            onClick={() => { setSearchTerm(''); fetchDrawings(); }}
            className="p-2 bg-slate-100 text-slate-600 rounded-md text-xs  hover:bg-slate-200 transition-colors"
          >
            Reset
          </button>
        </form>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 bg-white">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Drawing No</th>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Latest Rev</th>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">PO / SO Ref</th>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Description</th>
                <th className="p-2 text-left text-xs  text-slate-500  tracking-wider">Last Used</th>
                <th className="p-2text-center text-xs  text-slate-500  tracking-wider">PDF</th>
                <th className="p-2 text-right text-xs  text-slate-500  tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 italic">Loading drawing records...</td></tr>
              ) : drawings.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">No drawings found matching your criteria</td></tr>
              ) : (
                drawings.map((drawing, idx) => (
                  <tr key={`${drawing.drawing_no}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 whitespace-nowrap text-sm text-slate-900">{drawing.drawing_no}</td>
                    <td className="p-2 whitespace-nowrap text-sm text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">{drawing.revision_no || '0'}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="text-xs text-slate-900">{drawing.po_number || 'N/A'}</div>
                      <div className="text-[10px] text-slate-500">SO-{String(drawing.sales_order_id).padStart(4, '0')}</div>
                    </td>
                    <td className="p-2 text-xs text-slate-500 max-w-xs truncate ">{drawing.description}</td>
                    <td className="p-2 whitespace-nowrap text-xs text-slate-500">
                      {new Date(drawing.last_used_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-2 text-left">
                      {drawing.drawing_pdf ? (
                        <a 
                          href={`${API_BASE.replace('/api', '')}/${drawing.drawing_pdf}`} 
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
                    <td className="p-2 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(drawing)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Drawing"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleViewRevisions(drawing)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Revision History"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(drawing)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Drawing"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Drawing: ${editData.drawing_no}`}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormControl label="Revision No">
              <input 
                type="text" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={editData.revision_no}
                onChange={(e) => setEditData({...editData, revision_no: e.target.value})}
              />
            </FormControl>
          </div>
          <FormControl label="Description">
            <textarea 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] transition-all"
              value={editData.description}
              onChange={(e) => setEditData({...editData, description: e.target.value})}
            />
          </FormControl>
          <FormControl label="Upload PDF">
            <input 
              type="file" 
              accept=".pdf"
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
              onChange={(e) => setEditData({...editData, drawing_pdf: e.target.files[0]})}
            />
          </FormControl>
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saveLoading}
              className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
            >
              {saveLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showRevisions}
        onClose={() => setShowRevisions(false)}
        title={`Revision History: ${selectedDrawing?.drawing_no}`}
      >
        <div className="">
          {revisionsLoading ? (
            <div className="py-12 text-center text-slate-500 italic">Fetching revisions...</div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 bg-white">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-slate-500">Rev</th>
                    <th className="p-2 text-left text-xs font-medium text-slate-500">Date</th>
                    <th className="p-2 text-left text-xs font-medium text-slate-500">Description</th>
                    <th className="p-2 text-left text-xs font-medium text-slate-500">File</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Order</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {revisions.map((rev, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono font-medium text-indigo-600">{rev.revision_no || '0'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {new Date(rev.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{rev.description}</td>
                      <td className="px-4 py-3">
                        {rev.drawing_pdf ? (
                          <a 
                            href={`${API_BASE.replace('/api', '')}/${rev.drawing_pdf}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            View PDF
                          </a>
                        ) : <span className="text-slate-400 text-xs italic">No file</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-medium text-slate-700">{rev.po_number || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">SO-{String(rev.sales_order_id || 0).padStart(4, '0')}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <button 
              onClick={() => setShowRevisions(false)}
              className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DrawingMaster;
