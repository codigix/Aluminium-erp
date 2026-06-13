import React from 'react';
import { Modal } from './ui.jsx';
import { FileText, Download, Hash, Calendar, User, Package, MessageSquare, History, ExternalLink, X } from 'lucide-react';
import { getFileUrl } from '../utils/url';

const DrawingPreviewModal = ({ isOpen, onClose, drawing }) => {
  const [activeIdx, setActiveIdx] = React.useState(0);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [drawing]);

  if (!drawing) return null;

  const filePath = drawing.file_path || drawing.drawing_pdf || '';
  const files = filePath.split(',').filter(Boolean);
  const activeFilePath = files[activeIdx] || '';
  const fileUrl = getFileUrl(activeFilePath);
  const extension = activeFilePath.split('?')[0].toLowerCase().split('.').pop();
  
  const serverFileType = (drawing.file_type || '').toUpperCase();
  
  let type = 'other';
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP'].includes(serverFileType) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
    type = 'image';
  } else if (serverFileType === 'PDF' || extension === 'pdf') {
    type = 'pdf';
  } else if (['DXF', 'DWG'].includes(serverFileType) || ['dxf', 'dwg'].includes(extension)) {
    type = 'cad';
  }

  const previewFile = {
    url: fileUrl,
    name: (activeFilePath.split('/').pop().replace(/^\d+-/, '')) || drawing.drawing_no || drawing.name || 'Drawing',
    type: type,
    extension: extension
  };

  const DetailItem = ({ icon: Icon, label, value }) => (
    <div className="flex flex-col gap-1 p-2 bg-slate-50/50 border border-slate-100 rounded  hover:bg-white hover:shadow-sm transition-all duration-300">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={14} className="opacity-70" />
        <span className="text-xs   ">{label}</span>
      </div>
      <div className="text-xs  text-slate-900 truncate">
        {value || '—'}
      </div>
    </div>
  );

  // PDF Viewer URL (Google Docs viewer for better compatibility)
  const pdfViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url)}&embedded=true`;
  
  // CAD Viewer (ShareCAD.org free viewer)
  const cadViewerUrl = `https://sharecad.org/cadframe/load?url=${encodeURIComponent(previewFile.url)}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Drawing Insight: ${previewFile.name}`}
      size="4xl"
      className="rounded shadow-xl"
      overlayClassName="z-[60]"
    >
      <div className="flex flex-col lg:flex-row gap-2 h-[60vh]">
        {/* Sidebar Details */}
        <div className="w-full lg:w-64 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
          <div className="p-2 bg-indigo-600 rounded  text-white  shadow-indigo-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 bg-white/20 rounded  backdrop-blur-sm">
                <FileText size={15} />
              </div>
              <h3 className=" text-sm  truncate">{previewFile.name}</h3>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded  w-fit border border-white/10 backdrop-blur-sm">
              <History size={12} />
              <span className="text-xs   ">Rev: {drawing.revision || drawing.revision_no || '0'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <DetailItem 
              icon={Package} 
              label="Description" 
              value={drawing.description} 
            />
            <DetailItem 
              icon={User} 
              label="Client / Vendor" 
              value={drawing.client_name} 
            />
            <DetailItem 
              icon={Hash} 
              label="Quantity" 
              value={drawing.qty} 
            />
            <DetailItem 
              icon={Calendar} 
              label="Updated On" 
              value={new Date(drawing.updated_at || drawing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} 
            />
          </div>

          <div className="mt-auto pt-2 flex flex-col gap-2">
            <a 
              href={previewFile.url} 
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded  text-xs  hover:bg-slate-800 transition-all shadow-sm"
            >
              <ExternalLink size={12} />
              Open New Tab
            </a>
            <a 
              href={previewFile.url} 
              download 
              className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-indigo-600 rounded  text-xs  hover:bg-slate-50 transition-all"
            >
              <Download size={12} />
              Download
            </a>
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 bg-slate-50 rounded  border border-slate-200 overflow-hidden relative group flex flex-col">
          {files.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100 border-b border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-1">Files ({files.length}):</span>
              {files.map((file, idx) => {
                const name = file.split('/').pop().replace(/^\d+-/, '');
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`px-2 py-0.5 text-[10px] rounded transition-all truncate max-w-[150px] font-medium border ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    title={name}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          
          <div className="flex-1 relative w-full h-full overflow-hidden">
            {previewFile.type === 'image' ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              <img 
                src={previewFile.url} 
                alt={previewFile.name} 
                crossOrigin="anonymous"
                className="max-w-full max-h-full object-contain shadow-lg rounded transition-transform duration-500 group-hover:scale-[1.01]"
                onError={(e) => {
                  console.error('Image preview error:', e);
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ) : previewFile.type === 'pdf' ? (
            <div className="w-full h-full relative">
              <object
                data={previewFile.url}
                type="application/pdf"
                className="w-full h-full border-0 bg-white"
              >
                <iframe 
                  src={pdfViewerUrl} 
                  key={previewFile.url}
                  title={previewFile.name}
                  className="w-full h-full border-0 bg-white"
                  loading="lazy"
                />
              </object>
              <div className="absolute inset-0 pointer-events-none  group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                 <div className="bg-white/90 backdrop-blur p-1.5 rounded  shadow-lg border border-slate-200 pointer-events-auto">
                    <p className="text-xs  text-slate-500">PDF issue? <a href={previewFile.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Open directly</a></p>
                 </div>
              </div>
            </div>
          ) : previewFile.type === 'cad' ? (
            <div className="w-full h-full relative">
               <iframe 
                  src={cadViewerUrl}
                  title={previewFile.name}
                  className="w-full h-full border-0 bg-white"
                  loading="lazy"
                />
                <div className="absolute inset-0 pointer-events-none  group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                 <div className="bg-white/90 backdrop-blur p-1.5 rounded  shadow-lg border border-slate-200 pointer-events-auto">
                    <p className="text-xs  text-slate-500">CAD Preview by ShareCAD. <a href={previewFile.url} download className="text-indigo-600 underline">Download File</a></p>
                 </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2">
              <div className="text-center p-2 bg-white rounded border border-slate-100 shadow-sm max-w-xs">
                <div className="w-5 h-5 bg-indigo-50 rounded  flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-3 h-3 text-indigo-500 opacity-60" />
                </div>
                <h3 className="text-slate-900  text-sm mb-1">Preview Not Available</h3>
                <p className="text-slate-500 text-xs mb-4 leading-relaxed">Format (.{previewFile.extension}) cannot be rendered directly.</p>
                <a 
                  href={previewFile.url} 
                  download 
                  className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded  text-xs  hover:bg-indigo-700 transition-all  shadow-indigo-100"
                >
                  <Download size={14} />
                  Download
                </a>
              </div>
            </div>
          )}

          <div className="absolute top-2 right-2 flex gap-2  group-hover:opacity-100 transition-opacity duration-300">
             <button
                onClick={onClose}
                className="p-1.5 bg-white/80 backdrop-blur-md text-slate-600 rounded  hover:bg-white  transition-all"
                title="Close Preview"
             >
                <X size={14} />
             </button>
          </div>
        </div>
      </div>
      </div>
    </Modal>
  );
};

export default DrawingPreviewModal;
