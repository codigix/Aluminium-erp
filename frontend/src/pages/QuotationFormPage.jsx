import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, Trash2, Save, X, Send, 
  FileText, Calendar, User, Hash, 
  ChevronLeft, Loader2, Calculator,
  Building2, Mail, Phone, MapPin,
  GitBranch, Clock, AlertCircle, ArrowUpRight,
  Check, XCircle
} from 'lucide-react';
import { Card, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

const QuotationFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { initialData } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotationNo, setQuotationNo] = useState('Generating...');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [version, setVersion] = useState(1);
  const [parentId, setParentId] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [mode, setMode] = useState('create'); // 'create', 'revise', or 'received'
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const hasInitialized = useRef(false);

  // Locking logic: Only the latest version can be edited, and only if it's NOT approved.
  const maxVersion = versionHistory.length > 0 
    ? Math.max(...versionHistory.map(vh => vh.version)) 
    : version;
  const isLatest = version === maxVersion;
  
  // Find if the absolute latest version is already approved
  const latestInHistory = versionHistory.find(vh => vh.version === maxVersion);
  const isLatestApproved = latestInHistory?.status?.toUpperCase() === 'APPROVED';

  const currentVersionData = versionHistory.find(v => v.version === version);
  const isCurrentApproved = currentVersionData?.status?.toUpperCase() === 'APPROVED';
  
  // Old versions are always read-only, and the latest is locked if already approved
  const isLocked = (versionHistory.length > 0 && !isLatest) || isCurrentApproved;

  useEffect(() => {
    fetchClients();
    fetchDrawings();
    
    if (initialData && !hasInitialized.current) {
      hasInitialized.current = true;
      generateQuotationNo();
      setVersion(initialData.version || 1);
      setParentId(initialData.parentId || null);
      setBatchId(initialData.batchId || null);
      setMode(initialData.mode || 'create');
      if (initialData.parentId || initialData.id) {
        fetchVersionHistory(initialData.parentId || initialData.id);
      }
      setSelectedClient({
        id: initialData.clientId,
        company_name: initialData.clientName,
        email: initialData.clientEmail,
        contact_person: initialData.contact_person,
        phone: initialData.phone,
        address: initialData.address
      });
      setProjectName(initialData.projectName || '');
      
      const mappedItems = (initialData.items || []).map(item => ({
        ...item,
        id: item.id || Date.now() + Math.random(),
        total: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
        gst_percentage: item.gst_percentage || 18,
        isManual: !item.drawing_id && !!item.drawing_no
      }));
      
      setItems(mappedItems);
      setNotes(initialData.notes || '');
    } else if (!hasInitialized.current) {
      generateQuotationNo();
      hasInitialized.current = true;
    }
  }, [initialData]);

  useEffect(() => {
    if (items.length > 0 && drawings.length > 0) {
      const itemsWithDrawingIds = items.map(item => {
        if (!item.drawing_id && item.drawing_no) {
          const matchedDrawing = drawings.find(d => 
            String(d.drawing_no).trim().toLowerCase() === String(item.drawing_no).trim().toLowerCase()
          );
          if (matchedDrawing) {
            return { ...item, drawing_id: matchedDrawing.id };
          }
        }
        return item;
      });
      
      // Only update if something changed to avoid infinite loop
      const hasChanges = itemsWithDrawingIds.some((it, idx) => it.drawing_id !== items[idx].drawing_id);
      if (hasChanges) {
        setItems(itemsWithDrawingIds);
      }
    }
  }, [drawings]);

  useEffect(() => {
    if (items.length > 0) {
      const drawingNumbers = [...new Set(items.map(item => item.drawing_no).filter(no => !!no))];
      if (drawingNumbers.length > 0) {
        const drwNotes = `Drawing Numbers: ${drawingNumbers.join(', ')}`;
        // Only auto-update if notes is empty or already contains only drawing numbers
        if (!notes || notes.startsWith('Drawing Numbers:')) {
          setNotes(drwNotes);
        }
      }
    }
  }, [items]);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchDrawings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDrawings(data);
      }
    } catch (error) {
      console.error('Error fetching drawings:', error);
    }
  };

  const fetchVersionHistory = async (id) => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/versions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Sort history ASC (V1 at top) as per standard ERP audit trail
        const sortedHistory = [...data].sort((a, b) => a.version - b.version);
        setVersionHistory(sortedHistory);
        
        // Default to loading the latest version if we're not in a fresh creation mode
        const currentMode = initialData?.mode || mode;
        if (sortedHistory.length > 0 && currentMode !== 'create') {
          // Newest is the last item in ASC sort
          const latest = sortedHistory[sortedHistory.length - 1];
          loadVersionData(latest);
        }
      }
    } catch (error) {
      console.error('Error fetching version history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadVersionData = (v) => {
    // This allows switching between versions dynamically in the form
    setVersion(v.version);
    setSelectedVersionId(v.id);
    setBatchId(v.batch_id || null);
    setQuotationNo(`QRT-${String(v.id).padStart(4, '0')}`);
    setQuotationDate(v.created_at.split('T')[0]);
    setProjectName(v.project_name || '');
    setNotes(v.notes || '');
    
    // Map items from the version
    if (v.items && v.items.length > 0) {
      setItems(v.items.map(item => ({
        ...item,
        id: item.id || Date.now() + Math.random(),
        total: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
        gst_percentage: item.gst_percentage || 18,
        drawing_no: item.drawing_no,
        description: item.description
      })));
    }
  };

  const handleApproveVersion = async (v) => {
    try {
      const result = await Swal.fire({
        title: `Approve Version ${v.version}?`,
        text: "This will set this version as Approved.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Yes, Approve'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${v.id}/approve`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast(`Version ${v.version} approved`);
          fetchVersionHistory(parentId || initialData?.id || v.id);
        } else {
          throw new Error('Failed to approve version');
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleRejectVersion = async (v) => {
    try {
      const { value: reason } = await Swal.fire({
        title: `Reject Version ${v.version}?`,
        input: 'textarea',
        inputLabel: 'Rejection Reason',
        inputPlaceholder: 'Enter reason for rejection...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Reject'
      });

      if (reason !== undefined) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${v.id}/reject`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ reason })
        });

        if (response.ok) {
          successToast(`Version ${v.version} rejected`);
          fetchVersionHistory(parentId || initialData?.id || v.id);
        } else {
          throw new Error('Failed to reject version');
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleDeleteVersion = async (v) => {
    try {
      const result = await Swal.fire({
        title: `Delete Version ${v.version}?`,
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Delete'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotation-requests/${v.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          successToast(`Version ${v.version} deleted`);
          const newHistory = versionHistory.filter(item => item.id !== v.id);
          setVersionHistory(newHistory);
          if (newHistory.length === 0) {
            navigate('/client-quotations');
          } else if (selectedVersionId === v.id) {
            loadVersionData(newHistory[0]);
          }
        } else {
          throw new Error('Failed to delete version');
        }
      }
    } catch (error) {
      errorToast(error.message);
    }
  };

  const generateQuotationNo = async () => {
    // In a real app, this would come from the backend
    // For now, we'll simulate it
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setQuotationNo(`QRT-${randomNum}`);
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      drawing_no: '',
      description: '',
      quantity: 1,
      unit: 'Nos',
      rate: 0,
      total: 0,
      gst_percentage: 18,
      isManual: false
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updatedItem.total = (parseFloat(updatedItem.quantity) || 0) * (parseFloat(updatedItem.rate) || 0);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  const handleDownloadPDF = async () => {
    const idToDownload = selectedVersionId || initialData?.id;
    if (!idToDownload) {
      errorToast('Please save the quotation first to download PDF');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/download-pdf/${idToDownload}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation_${quotationNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      successToast('PDF download started');
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPDF = async (versionId) => {
    if (!versionId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/download-pdf/${versionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // We don't revoke immediately as the new tab needs it
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = () => {
    const baseAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const gstAmount = items.reduce((sum, item) => {
      const itemTotal = parseFloat(item.total) || 0;
      const gstPercent = parseFloat(item.gst_percentage) || 18;
      return sum + (itemTotal * gstPercent / 100);
    }, 0);
    return {
      baseAmount,
      gstAmount,
      totalAmount: baseAmount + gstAmount
    };
  };

  const summary = calculateSummary();

  const handleSave = async (status = 'Draft', sendEmail = null) => {
    if (!selectedClient) {
      errorToast('Please select a client');
      return;
    }
    
    // Determine if email should be sent
    // If sendEmail is provided (true/false), use it. 
    // Otherwise fallback to legacy logic: status 'Sent' or 'Revised' usually implied email
    const finalSendEmail = sendEmail !== null ? sendEmail : (status === 'Sent' || status === 'Revised');

    if (finalSendEmail && !selectedClient?.email) {
      errorToast('Client email is required to send quotation');
      return;
    }
    if (items.length === 0) {
      errorToast('Please add at least one item');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');
      
      const isRevision = status.toUpperCase() === 'REVISED';
      // Find the absolute latest version number in history to increment from
      const latestHistoryVersion = versionHistory.length > 0 
        ? Math.max(...versionHistory.map(vh => vh.version)) 
        : (version > 1 ? version - 1 : 0);
      
      const finalVersion = isRevision ? latestHistoryVersion + 1 : version;

      const quotationData = {
        clientId: selectedClient.id,
        clientName: selectedClient.company_name,
        clientEmail: selectedClient.email,
        projectName: projectName,
        items: items.map(item => ({
          salesOrderItemId: item.salesOrderItemId || null,
          orderId: item.orderId || null,
          drawing_no: item.drawing_no,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || 'Nos',
          quotedPrice: parseFloat(item.rate) || 0,
          gst_percentage: parseFloat(item.gst_percentage) || 18,
          status: status.toUpperCase() === 'REVISED' ? 'REVISED' : (item.status || 'SENT'),
          profit_percentage: 0
        })),
        totalAmount: summary.totalAmount,
        notes: notes,
        status: status.toUpperCase(),
        emailRequired: finalSendEmail,
        quotation_no: quotationNo,
        date: quotationDate,
        version: finalVersion,
        parentId: parentId,
        batch_id: batchId
      };

      const response = await fetch(`${API_BASE}/quotation-requests/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quotationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save quotation');
      }

      const message = status === 'Draft' 
        ? 'Quotation saved as draft' 
        : finalSendEmail 
          ? 'Quotation sent to client successfully' 
          : 'Quotation updated successfully';
      successToast(message);
      navigate('/client-quotations');
    } catch (error) {
      errorToast(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-2 space-y-4 bg-slate-50 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-slate-500 mb-0.5">
            <button 
              onClick={() => navigate('/client-quotations')}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider">Sales / Quotations</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {mode === 'received' ? 'Received Quotation' : (version > 1 ? 'Revise Quotation' : 'Create Quotation')}
            {version > 1 && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-200">
                V{version}
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-[11px]">
            {mode === 'received' ? 'Review and manage incoming customer response' : (version > 1 ? `Revising from previous version history` : 'Professional Quotation Management')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/client-quotations')}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <X size={14} />
            {isLocked ? 'Close' : 'Cancel'}
          </button>

          {!isLocked && (
            <>
              {mode === 'received' ? (
                <>
                  <button
                    onClick={() => handleSave('Rejected', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    Reject
                  </button>
                  <button
                    onClick={() => handleSave('Approved', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleSave('Revised', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                    Create Revision
                  </button>
                  <button
                    onClick={() => handleSave('Revised', true)}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to Client
                  </button>
                  {(selectedVersionId || initialData?.id) && (
                    <button
                      onClick={handleDownloadPDF}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Download PDF
                    </button>
                  )}
                </>
              ) : mode === 'revise' ? (
                <>
                  <button
                    onClick={() => handleSave('Draft', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave('Revised', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                    Create Revision
                  </button>
                  <button
                    onClick={() => handleSave('Revised', true)}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to Client
                  </button>
                  {(selectedVersionId || initialData?.id) && (
                    <button
                      onClick={handleDownloadPDF}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Download PDF
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSave('Draft')}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave('Sent', false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create Quotation
                  </button>
                  <button
                    onClick={() => handleSave('Sent', true)}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to Client
                  </button>
                  {(selectedVersionId || initialData?.id) && (
                    <button
                      onClick={handleDownloadPDF}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Download PDF
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section 1: Quotation Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <FileText size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Quotation Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash size={12} /> Quotation No
                </label>
                <input 
                  type="text" 
                  value={quotationNo}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} /> Quotation Date
                </label>
                <input 
                  type="date" 
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  readOnly={isLocked}
                  className={`w-full px-3 py-2 border rounded-lg text-xs outline-none transition-all ${isLocked ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} /> Client Name
                </label>
                <SearchableSelect
                  options={clients}
                  value={selectedClient?.id || ''}
                  disabled={isLocked}
                  onChange={(val) => {
                    const client = clients.find(c => String(c.id) === String(val));
                    setSelectedClient(client ? {
                      id: client.id,
                      company_name: client.company_name,
                      email: client.email,
                      contact_person: client.contact_person,
                      phone: client.phone,
                      address: client.address
                    } : null);
                  }}
                  placeholder="Select Client"
                  labelField="company_name"
                  valueField="id"
                  subLabelField="email"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={12} /> Project Name
                </label>
                <input 
                  type="text" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  readOnly={isLocked}
                  placeholder={isLocked ? "" : "Enter project name..."}
                  className={`w-full px-3 py-2 border rounded-lg text-xs outline-none transition-all ${isLocked ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Status
                </label>
                <div className="flex items-center">
                  <StatusBadge status={currentVersionData?.status || 'Draft'} />
                </div>
              </div>
            </div>

            {selectedClient && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <Mail size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Email</p>
                    <p className="text-xs text-slate-600">{selectedClient.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <Phone size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Phone</p>
                    <p className="text-xs text-slate-600">{selectedClient.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <MapPin size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Address</p>
                    <p className="text-xs text-slate-600 line-clamp-1">{selectedClient.address || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Section 2: Quotation Items */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Calculator size={16} />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Quotation Items</h2>
              </div>
              {!isLocked && (
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <Plus size={14} />
                  Add Item
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="w-12 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">No.</th>
                    <th className="w-72 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Drawing & Description</th>
                    <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Qty</th>
                    <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Rate (₹)</th>
                    <th className="w-40 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Total (₹)</th>
                    {!isLocked && <th className="w-20 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={isLocked ? "5" : "6"} className="px-4 py-10 text-center text-slate-400 text-xs italic">
                        {isLocked ? "No items in this version." : "No items added yet. Click \"Add Item\" to begin."}
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-medium text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 group">
                              <div className="flex-1">
                                {(mode === 'received' || isLocked) ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900">{item.drawing_no || 'Manual Item'}</span>
                                    {!isLocked && <span className="text-[11px] text-slate-500 whitespace-pre-line">{item.description}</span>}
                                  </div>
                                ) : (item.isManual || mode === 'revise') ? (
                                  <input 
                                    type="text"
                                    placeholder="Drawing No..."
                                    value={item.drawing_no}
                                    onChange={(e) => handleItemChange(item.id, 'drawing_no', e.target.value)}
                                    className="w-full px-0 py-0 text-sm font-bold text-slate-900 border-none focus:ring-0 placeholder:text-slate-300 bg-transparent"
                                  />
                                ) : (
                                  <SearchableSelect
                                    options={drawings}
                                    value={item.drawing_id}
                                    disabled={isLocked}
                                    onChange={(val) => {
                                      const drw = drawings.find(d => String(d.id) === String(val));
                                      const updatedItems = items.map(it => {
                                        if (it.id === item.id) {
                                          const newRate = drw?.rate || drw?.quotedPrice || drw?.bom_cost || it.rate || 0;
                                          return {
                                            ...it,
                                            drawing_id: val,
                                            drawing_no: drw?.drawing_no || '',
                                            description: drw?.description || '',
                                            rate: newRate,
                                            total: (parseFloat(it.quantity) || 0) * (parseFloat(newRate) || 0)
                                          };
                                        }
                                        return it;
                                      });
                                      setItems(updatedItems);
                                    }}
                                    placeholder="Select Drawing..."
                                    labelField="drawing_no"
                                    valueField="id"
                                    subLabelField="description"
                                    className="border-none p-0 focus-within:ring-0 shadow-none bg-transparent font-bold text-sm"
                                  />
                                )}
                              </div>
                              {!isLocked && mode !== 'received' && (
                                <button 
                                  onClick={() => {
                                    const updatedItems = items.map(it => {
                                      if (it.id === item.id) {
                                        return { 
                                          ...it, 
                                          isManual: !it.isManual,
                                          drawing_id: '',
                                          drawing_no: '',
                                          description: '',
                                          rate: 0,
                                          total: 0
                                        };
                                      }
                                      return it;
                                    });
                                    setItems(updatedItems);
                                  }}
                                  title={item.isManual ? "Switch to Master" : "Manual Entry"}
                                  className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${item.isManual ? 'text-amber-500 bg-amber-50' : 'text-slate-400 bg-slate-50'}`}
                                >
                                  <Hash size={12} />
                                </button>
                              )}
                            </div>
                            
                            {(isLocked || mode === 'received') ? (
                              <p className="text-[11px] text-slate-500 italic mt-1 whitespace-pre-line">{item.description || 'No description'}</p>
                            ) : (
                              <textarea 
                                placeholder="Add item description..."
                                value={item.description}
                                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                rows="1"
                                className="w-full px-0 py-0 text-[11px] text-slate-500 border-none focus:ring-0 resize-none bg-transparent placeholder:text-slate-300"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              value={item.quantity}
                              readOnly={isLocked}
                              onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                              className={`w-full px-2 py-1 text-xs border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700 font-medium' : 'bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                            />
                            <span className="text-[10px] text-slate-400 font-medium">{item.unit || 'Nos'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number"
                            value={item.rate}
                            readOnly={isLocked}
                            onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                            className={`w-full px-2 py-1 text-xs font-semibold border rounded outline-none transition-all ${isLocked ? 'bg-transparent border-transparent text-slate-700' : 'bg-white border-slate-200 text-indigo-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">
                          {formatCurrency(item.total)}
                        </td>
                        {!isLocked && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Section 3: Summary / Calculation */}
        <div className="space-y-4">
          <Card className="p-5 sticky top-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Calculator size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Summary</h2>
            </div>

            <div className="space-y-3">
              {version > 1 && versionHistory.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    <AlertCircle size={12} /> Revision Comparison
                  </div>
                  {(() => {
                    const prevVersion = versionHistory.find(v => v.version === version - 1);
                    if (!prevVersion) return null;
                    const diff = summary.totalAmount - (parseFloat(prevVersion.received_amount) || parseFloat(prevVersion.total_amount) * 1.18);
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Previous (V{version-1})</span>
                          <span className="text-slate-700 font-medium">{formatCurrency(parseFloat(prevVersion.received_amount) || parseFloat(prevVersion.total_amount) * 1.18)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Net Change</span>
                          <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Base Amount</span>
                <span className="text-slate-900 font-bold">{formatCurrency(summary.baseAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">GST (18%)</span>
                <span className="text-slate-900 font-bold">{formatCurrency(summary.gstAmount)}</span>
              </div>
              
              <div className="pt-3 mt-3 border-t border-slate-100">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                    <p className="text-xl font-black text-indigo-600 tracking-tight">{formatCurrency(summary.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>

            {versionHistory.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-slate-400" />
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Version History</h3>
                </div>
                <div className="space-y-2">
                  {versionHistory.map((v) => {
                    const isViewable = v.status?.toUpperCase() === 'APPROVED' || v.status?.toUpperCase() === 'REVISED';
                    return (
                      <div 
                        key={v.id} 
                        onClick={() => {
                          if (isViewable) {
                            loadVersionData(v);
                            handleViewPDF(v.id);
                          }
                        }}
                        className={`w-full p-2.5 rounded-xl border transition-all group ${
                          isViewable ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 active:scale-[0.98]' : 'cursor-default opacity-80'
                        } ${
                          v.id === selectedVersionId || (selectedVersionId === null && v.version === version)
                            ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100 shadow-sm' 
                            : 'bg-white border-slate-100'
                        }`}
                      >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${
                            v.status?.toUpperCase() === 'APPROVED' ? 'bg-emerald-500 ring-2 ring-emerald-100' : 
                            v.status?.toUpperCase() === 'REJECTED' ? 'bg-rose-500 ring-2 ring-rose-100' :
                            (v.id === selectedVersionId || (selectedVersionId === null && v.version === version)) ? 'bg-indigo-500 ring-2 ring-indigo-100' : 'bg-slate-300'
                          }`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`text-[11px] font-bold ${(v.id === selectedVersionId || (selectedVersionId === null && v.version === version)) ? 'text-indigo-700' : 'text-slate-700'}`}>
                                Version {v.version}
                              </p>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border tracking-tighter ${
                                v.status?.toUpperCase() === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                v.status?.toUpperCase() === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                                'bg-slate-50 border-slate-100 text-slate-500'
                              }`}>
                                {v.status}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={10} /> {new Date(v.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black text-slate-900">
                            {formatCurrency(parseFloat(v.received_amount) || parseFloat(v.total_amount) * 1.18)}
                          </p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteVersion(v); }}
                            className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Version"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

                {/* Actions for Selected Version */}
                {(() => {
                  const selectedV = versionHistory.find(v => v.id === selectedVersionId || (selectedVersionId === null && v.version === version));
                  const sStatus = selectedV?.status?.toUpperCase();
                  // Hide actions if selected is approved/rejected, OR if the latest version is already approved
                  if (!selectedV || sStatus === 'APPROVED' || sStatus === 'REJECTED' || isLatestApproved) return null;
                  
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleRejectVersion(selectedV)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 hover:bg-rose-100 transition-all shadow-sm shadow-rose-50"
                      >
                        <XCircle size={14} />
                        Reject V{selectedV.version}
                      </button>
                      <button
                        onClick={() => handleApproveVersion(selectedV)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm shadow-emerald-50"
                      >
                        <Check size={14} />
                        Approve V{selectedV.version}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  readOnly={isLocked}
                  placeholder={isLocked ? "" : "Additional terms..."}
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all resize-none h-24 ${isLocked ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'}`}
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex gap-2">
                  <div className="text-amber-600 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                    PDF can be downloaded at any time after saving.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationFormPage;
