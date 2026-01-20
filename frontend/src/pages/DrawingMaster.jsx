import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl text-slate-900">Drawing Master</h1>
          <p className="text-sm text-slate-500">Central repository for all engineering drawings and revisions</p>
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

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Drawing No</th>
                <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Latest Rev</th>
                <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">PO / SO Ref</th>
                <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Used</th>
                <th className="p-2text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">PDF</th>
                <th className="p-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
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
                    <td className="p-2 text-sm text-slate-500 max-w-xs truncate">{drawing.description}</td>
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
                    <td className="p-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button 
                        onClick={() => handleEdit(drawing)}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleViewRevisions(drawing)}
                        className="text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900 opacity-75" onClick={() => setShowEditModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl text-slate-900 mb-4">Edit Drawing: {editData.drawing_no}</h3>
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
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-900 opacity-75" onClick={() => setShowRevisions(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:min-h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl text-slate-900">
                      Revision History: {selectedDrawing?.drawing_no}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setShowRevisions(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4">
                  {revisionsLoading ? (
                    <div className="py-12 text-center text-slate-500 italic">Fetching revisions...</div>
                  ) : (
                    <div className="overflow-hidden border border-slate-100 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase">Rev</th>
                            <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                            <th className="p-2text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                            <th className="p-2text-center text-xs font-semibold text-slate-500 uppercase">File</th>
                            <th className="p-2 text-right text-xs font-semibold text-slate-500 uppercase">Order</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {revisions.map((rev, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2 whitespace-nowrap text-sm font-mono font-bold text-indigo-600">{rev.revision_no || '0'}</td>
                              <td className="p-2 whitespace-nowrap text-sm text-slate-600">
                                {new Date(rev.created_at).toLocaleDateString('en-IN')}
                              </td>
                              <td className="p-2 text-sm text-slate-500">{rev.description}</td>
                              <td className="p-2 text-left">
                                {rev.drawing_pdf ? (
                                  <a 
                                    href={`${API_BASE.replace('/api', '')}/${rev.drawing_pdf}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    View PDF
                                  </a>
                                ) : '—'}
                              </td>
                              <td className="p-2 text-right">
                                <div className="text-xs font-bold text-slate-700">{rev.po_number || 'N/A'}</div>
                                <div className="text-[10px] text-slate-400">SO-{String(rev.sales_order_id).padStart(4, '0')}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowRevisions(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingMaster;
