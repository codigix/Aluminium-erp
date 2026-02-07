import React from 'react';
import { Modal } from './ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const DrawingPreviewModal = ({ isOpen, onClose, drawing }) => {
  if (!drawing) return null;

  const filePath = drawing.file_path || drawing.drawing_pdf || '';
  const fileUrl = `${API_BASE.replace('/api', '')}/${filePath}`;
  const extension = filePath.toLowerCase().split('.').pop();
  
  let type = 'other';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
    type = 'image';
  } else if (extension === 'pdf') {
    type = 'pdf';
  }

  const previewFile = {
    url: fileUrl,
    name: drawing.drawing_no || drawing.name || 'Drawing',
    type: type,
    extension: extension
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Drawing Preview: ${previewFile.name}`}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg min-h-[400px]">
        {previewFile.type === 'image' ? (
          <img 
            src={previewFile.url} 
            alt={previewFile.name} 
            className="max-w-full max-h-[70vh] object-contain shadow-lg rounded-md"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://via.placeholder.com/400?text=Drawing+Not+Found';
            }}
          />
        ) : previewFile.type === 'pdf' ? (
          <iframe 
            src={previewFile.url} 
            title={previewFile.name}
            className="w-full h-[70vh] border-0 rounded-md shadow-lg"
          />
        ) : (
          <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 max-w-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-slate-900 font-medium mb-1">Preview Not Available</h3>
            <p className="text-slate-500 text-xs mb-4">The file type (.{previewFile.extension}) cannot be previewed directly in the browser.</p>
            <a 
              href={previewFile.url} 
              download 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Download to View
            </a>
          </div>
        )}
        <div className="mt-4 flex gap-3">
          {previewFile.type !== 'other' && (
            <a 
              href={previewFile.url} 
              download 
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Download Drawing
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DrawingPreviewModal;
