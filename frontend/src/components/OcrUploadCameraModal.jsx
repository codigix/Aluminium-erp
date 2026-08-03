import React, { useState, useRef } from 'react';
import { Camera, Upload, RefreshCw, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';

const OcrUploadCameraModal = ({ isOpen, onClose, onExtractedData, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleProcessOcrAi = async () => {
    if (!selectedFile) {
      setError('Please select a file or take a photo first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
      const token = localStorage.getItem('authToken');

      const formData = new FormData();
      formData.append('poPdf', selectedFile);

      const response = await fetch(`${baseUrl}/customer-pos/ocr-parse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-ERP-Request': 'true'
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Failed to process PO using OCR & AI.');
      }

      if (resData && resData.extractedData) {
        if (showToast) showToast(`OCR + AI Extraction complete (${resData.ocrMethod || 'AI'})`);
        onExtractedData(resData.extractedData);
        onClose();
      } else {
        throw new Error('Invalid response structure from OCR AI parser.');
      }
    } catch (err) {
      console.error('OCR Processing error:', err);
      setError(err.message || 'Failed to process PO using OCR & AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            AI & OCR PO Smart Extractor
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden inputs for Mobile Camera & File Picker */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*,application/pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50 hover:bg-indigo-100/50 transition text-indigo-700 font-semibold"
          >
            <Camera className="w-9 h-9 mb-2 text-indigo-600" />
            Take Photo (Camera)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 hover:bg-blue-100/50 transition text-blue-700 font-semibold"
          >
            <Upload className="w-9 h-9 mb-2 text-blue-600" />
            Upload PDF / Image
          </button>
        </div>

        {/* Preview Section */}
        {previewUrl && (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-56 flex items-center justify-center bg-slate-900">
            {selectedFile?.type.startsWith('image/') ? (
              <img src={previewUrl} alt="PO Preview" className="max-h-56 object-contain" />
            ) : (
              <div className="p-8 text-white text-center">
                <p className="font-semibold text-lg">{selectedFile?.name}</p>
                <p className="text-xs text-slate-400">PDF Document selected</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Process Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedFile || loading}
            onClick={handleProcessOcrAi}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-md transition"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing OCR + AI...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Auto-Fill PO Form
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcrUploadCameraModal;
