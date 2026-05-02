import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, DataTable, Modal, FormControl, Tabs, Button } from '../components/ui.jsx';
import { Beaker, Clock, Inbox, Search, CheckCircle2, Eye, Edit, Trash2, ListTodo, AlertTriangle, RefreshCw, X, CheckCircle, XCircle, ShieldCheck, Mail, Paperclip, Send, Database, ShoppingCart, Truck, FileText, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const qcStatusColors = {
  PENDING: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
  IN_PROGRESS: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Partially' },
  PASSED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Passed' },
  FAILED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' },
  SHORTAGE: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Shortage' },
  OVERAGE: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Overage' },
  ACCEPTED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Accepted' }
};

const IncomingQC = ({ initialTab = 'incoming' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [qcInspections, setQcInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedQC, setSelectedQC] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    message: '',
    attachPDF: true
  });
  const [uploadingQcId, setUploadingQcId] = useState(null);
  const invoiceInputRef = useRef(null);
  const attachmentsInputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [isAttachmentsUploading, setIsAttachmentsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editFormData, setEditFormData] = useState({
    status: '',
    remarks: '',
    defects: '',
    passQuantity: '',
    failQuantity: '',
    items: []
  });

  // URL Synchronization
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    const id = searchParams.get('id');

    // Tab Sync
    if (segments[1] === 'in-process') setActiveTab('in-process');
    else if (segments[1] === 'final') setActiveTab('final');
    else setActiveTab('incoming');

    // Modal Sync
    if (id && qcInspections.length > 0) {
      const qc = qcInspections.find(q => q.id === parseInt(id));
      if (qc) {
        if (segments.includes('view')) {
          setSelectedQC(qc);
          setShowViewModal(true);
        } else if (segments.includes('edit')) {
          handleEditQC(qc);
        } else if (segments.includes('email')) {
          setSelectedQC(qc);
          openEmailModal(qc);
        }
      }
    } else {
      setShowViewModal(false);
      setShowEditModal(false);
      setShowEmailModal(false);
    }
  }, [location.pathname, searchParams, qcInspections]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchQCInspections = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        setQcInspections([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch QC Inspections');
      const data = await response.json();
      setQcInspections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching QC Inspections:', error);
      setQcInspections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          totalInspections: data.totalQc || 0,
          passed: (data.passedQc || 0) + (data.acceptedQc || 0),
          failed: data.failedQc || 0,
          pending: data.pendingQc || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchQCInspections();
    fetchStats();
  }, [fetchQCInspections, fetchStats]);

  const handleViewQC = (qc) => {
    const tabPath = activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`;
    navigate(`${tabPath}/view?id=${qc.id}`);
    fetchAttachments(qc.id);
  };

  const handleEditQC = (qc) => {
    const tabPath = activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`;
    // If we're already on the edit path (e.g. from URL sync), don't navigate again
    if (!location.pathname.includes('/edit')) {
      navigate(`${tabPath}/edit?id=${qc.id}`);
      return;
    }
    
    setSelectedQC(qc);
    fetchAttachments(qc.id);
    const items = (qc.items_detail || []).map(item => ({
      ...item,
      accepted_qty: item.accepted_qty !== undefined && item.accepted_qty !== null ? item.accepted_qty : (item.received_qty || 0),
      rejected_qty: item.rejected_qty !== undefined && item.rejected_qty !== null ? item.rejected_qty : 0,
      remarks: item.remarks || ''
    }));

    // Calculate initial status based on items ONLY if status is PENDING
    let hasShortageOverage = false;

    items.forEach(item => {
      const ordQty = parseFloat(item.ordered_qty || 0);
      const accQty = parseFloat(item.accepted_qty || 0);
      
      const discrepancy = Math.abs(ordQty - accQty);

      if (discrepancy > 0.001) {
        hasShortageOverage = true;
      }
    });

    let overallStatus = qc.status;
    if (qc.status === 'PENDING') {
      overallStatus = hasShortageOverage ? 'IN_PROGRESS' : 'PASSED';
    }

    setEditFormData({
      status: overallStatus,
      remarks: qc.remarks || '',
      defects: qc.defects || '',
      passQuantity: items.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0),
      failQuantity: items.reduce((sum, item) => sum + (parseFloat(item.rejected_qty) || 0), 0),
      items: items
    });
    setShowEditModal(true);
  };

  const fetchAttachments = async (qcId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}/attachments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleAttachmentsUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !selectedQC) return;

    const formData = new FormData();
    files.forEach(file => formData.append('attachments', file));

    try {
      setIsAttachmentsUploading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${selectedQC.id}/attachments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        successToast('Attachments uploaded successfully');
        fetchAttachments(selectedQC.id);
      } else {
        const errorData = await response.json();
        errorToast(errorData.message || 'Failed to upload attachments');
      }
    } catch (error) {
      console.error('Error uploading attachments:', error);
      errorToast('Error uploading attachments');
    } finally {
      setIsAttachmentsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    const result = await Swal.fire({
      title: 'Delete Attachment?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        successToast('Attachment deleted');
        fetchAttachments(selectedQC.id);
      }
    } catch {
      errorToast('Failed to delete attachment');
    }
  };

  const handleItemQtyChange = (idx, value) => {
    const newItems = [...editFormData.items];
    const qty = parseFloat(value) || 0;
    newItems[idx].accepted_qty = qty;
    
    // Auto-calculate rejected quantity (Discrepancy with Invoice)
    const received = parseFloat(newItems[idx].received_qty) || 0;
    const poQty = parseFloat(newItems[idx].ordered_qty || 0);
    newItems[idx].rejected_qty = Math.max(0, received - qty);
    
    // Update item status based on qty
    if (qty < poQty - 0.001) {
      newItems[idx].status = 'SHORTAGE';
    } else if (qty > poQty + 0.001) {
      newItems[idx].status = 'OVERAGE';
    } else {
      newItems[idx].status = 'AVAILABLE';
    }
    
    // Calculate Overall Status based on Items - ONLY if we want to auto-flip
    // If it's already IN_PROGRESS or PASSED, we might want to keep auto-calculation
    // but the user complained about it resetting to PASSED when they want it IN_PROGRESS
    
    let hasShortageOverage = false;

    newItems.forEach(item => {
      const ordQty = parseFloat(item.ordered_qty || 0);
      const accQty = parseFloat(item.accepted_qty || 0);
      
      const discrepancy = Math.abs(ordQty - accQty);

      if (discrepancy > 0.001) {
        hasShortageOverage = true;
      }
    });

    // Auto-calculate status only if currently in a non-final state
    let overallStatus = editFormData.status;
    if (['PENDING', 'IN_PROGRESS', 'SHORTAGE', 'OVERAGE'].includes(editFormData.status)) {
      overallStatus = hasShortageOverage ? 'IN_PROGRESS' : 'PASSED';
    }
    
    const totalAccepted = newItems.reduce((sum, item) => sum + (parseFloat(item.accepted_qty) || 0), 0);
    const totalRejected = newItems.reduce((sum, item) => sum + (parseFloat(item.rejected_qty) || 0), 0);

    setEditFormData({
      ...editFormData,
      items: newItems,
      status: overallStatus,
      passQuantity: totalAccepted,
      failQuantity: totalRejected
    });
  };

  const handleItemRemarksChange = (idx, value) => {
    const newItems = [...editFormData.items];
    newItems[idx].remarks = value;
    setEditFormData({ ...editFormData, items: newItems });
  };

  const handleUpdateQC = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${selectedQC.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      if (!response.ok) throw new Error('Failed to update inspection');

      successToast('Inspection updated successfully');
      setShowEditModal(false);
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingQcId) return;

    const formData = new FormData();
    formData.append('invoice', file);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${uploadingQcId}/invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        successToast('Invoice uploaded successfully');
        fetchQCInspections();
      } else {
        const errorData = await response.json();
        errorToast(errorData.message || 'Failed to upload invoice');
      }
    } catch (error) {
      console.error('Error uploading invoice:', error);
      errorToast('Error uploading invoice');
    } finally {
      setUploadingQcId(null);
      e.target.value = '';
    }
  };

  const openEmailModal = async (qc) => {
    const tabPath = activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`;
    if (!location.pathname.includes('/email')) {
      navigate(`${tabPath}/email?id=${qc.id}`);
      return;
    }

    try {
      setSelectedQC(qc);
      const shortageItems = (qc.items_detail || []).filter(item => (parseFloat(item.received_qty) || 0) > (parseFloat(item.accepted_qty) || 0));
      const overageItems = (qc.items_detail || []).filter(item => (parseFloat(item.accepted_qty) || 0) > (parseFloat(item.received_qty) || 0));
      
      let message = `Dear ${qc.vendor_name || 'Vendor'},\n\nThis is a notification regarding the Quality Control Inspection for GRN-${String(qc.grn_id).padStart(4, '0')} (PO: ${qc.po_number || 'N/A'}).\n\n`;
      
      if (shortageItems.length > 0) {
        message += `Shortage detected in the following items:\n`;
        shortageItems.forEach(item => {
          const diff = (parseFloat(item.received_qty) || 0) - (parseFloat(item.accepted_qty) || 0);
          message += `- ${item.material_name || item.item_code}: Shortage of ${diff.toFixed(3)} ${item.uom || 'Nos'}\n`;
        });
        message += `\n`;
      }
      
      if (overageItems.length > 0) {
        message += `Overage detected in the following items:\n`;
        overageItems.forEach(item => {
          const diff = (parseFloat(item.accepted_qty) || 0) - (parseFloat(item.received_qty) || 0);
          message += `- ${item.material_name || item.item_code}: Overage of ${diff.toFixed(3)} ${item.uom || 'Nos'}\n`;
        });
        message += `\n`;
      }

      message += `Regards,\nSPTECHPIONEER Quality Team`;

      setEmailData({
        to: qc.vendor_email || '',
        subject: `QC Inspection Alert: GRN-${String(qc.grn_id).padStart(4, '0')}`,
        message: message,
        attachPDF: true
      });
      setShowEmailModal(true);
    } catch (error) {
      console.error('Error:', error);
      errorToast('Failed to load vendor details');
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailData.to) return errorToast('Recipient email is required');

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${selectedQC.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        successToast('Notification sent to vendor');
        setShowEmailModal(false);
        fetchQCInspections();
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQC = async (qcId) => {
    const result = await Swal.fire({
      title: 'Delete Inspection?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete QC Inspection');

      successToast('QC Inspection has been removed');
      fetchQCInspections();
      fetchStats();
    } catch (error) {
      errorToast(error.message);
    }
  };

  const handleCreateStockEntry = async (qcId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}/stock-entry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create stock entry');
      }

      const result = await response.json();
      if (result.success === false) {
        errorToast(result.message);
      } else {
        successToast('Stock entry created successfully');
      }
    } catch (error) {
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async (qc) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      // Fetch the latest full details for this QC to ensure we have all item details
      const detailsRes = await fetch(`${API_BASE}/qc-inspections/${qc.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!detailsRes.ok) throw new Error('Failed to fetch inspection details');
      const fullQC = await detailsRes.json();
      const items = fullQC.items_detail || fullQC.items || [];

      const rejectedItems = items.filter(item => 
        parseFloat(item.rejected_qty || 0) > 0 || parseFloat(item.shortage || 0) > 0
      );
      
      if (rejectedItems.length === 0) {
        errorToast('No rejected items or shortages found to create a new PO.');
        return;
      }

      const result = await Swal.fire({
        title: 'Create Purchase Order?',
        text: `This will create a new PO for ${rejectedItems.length} items with shortages or rejections.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Create PO',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3b82f6'
      });

      if (!result.isConfirmed) return;

      const response = await fetch(`${API_BASE}/purchase-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: fullQC.vendor_id,
          notes: `Auto-generated from QC Inspection (GRN-${String(fullQC.grn_id).padStart(4, '0')}) - Replacement/Shortage Fulfillment`,
          items: rejectedItems.map(item => {
            const reorderQty = parseFloat(item.rejected_qty || 0) > 0 
              ? parseFloat(item.rejected_qty) 
              : parseFloat(item.shortage);
              
            return {
              item_code: item.item_code,
              description: item.description || item.material_name,
              quantity: reorderQty,
              unit: item.unit || 'NOS',
              rate: item.rate || 0,
              amount: reorderQty * (parseFloat(item.rate) || 0)
            };
          })
        })
      });

      if (response.ok) {
        successToast('Purchase Order created successfully');
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to create PO');
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast(error.message || 'Error creating Purchase Order');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (qc) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qc.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QC_Report_${qc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      errorToast('Failed to download QC Report');
    }
  };

  const handleBulkDownload = async (inspections) => {
    if (!inspections.length) return;
    
    const result = await Swal.fire({
      title: 'Generate Bulk Reports?',
      text: `This will download ${inspections.length} QC reports.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generate All',
      confirmButtonColor: '#f97316'
    });

    if (result.isConfirmed) {
      successToast(`Starting bulk download of ${inspections.length} reports...`);
      // Loop through and download each
      for (const qc of inspections) {
        await handleDownloadPdf(qc);
        // Small delay to prevent browser blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const columns = [
    {
      label: 'GRN #',
      key: 'grn_id',
      sortable: true,
      width: '8%',
      render: (val) => (
        <span className="text-indigo-600 font-medium">
          {val ? `GRN-${String(val).padStart(4, '0')}` : '—'}
        </span>
      )
    },
    {
      label: 'PO #',
      key: 'po_number',
      sortable: true,
      width: '12%',
      render: (val, row) => (
        <div className="flex flex-col">
          <div className="text-slate-900 font-medium text-[11px]">{val || '—'}</div>
          <div className="text-[10px] text-slate-500 truncate max-w-[120px]" title={row.vendor_name}>{row.vendor_name || '—'}</div>
        </div>
      )
    },
    {
      label: 'Project / Customer',
      key: 'project_name',
      sortable: true,
      width: '25%',
      className: 'whitespace-normal',
      render: (val, row) => {
        if (!val) return '—';
        // Intelligent split: break at " for " (case insensitive) to keep drawing numbers on top line
        const parts = val.split(/\s+for\s+/i);
        return (
          <div className="flex flex-col py-0.5 pr-2 max-w-[250px]">
            <div className="flex flex-col">
              <span className="text-slate-900 font-bold text-[11px] leading-tight">
                {parts[0]}
              </span>
              {parts.length > 1 && (
                <span className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                  for {parts.slice(1).join(' for ')}
                </span>
              )}
            </div>
            {row.company_name && (
              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100/50">
                <span className="px-1 py-0.5 bg-slate-100 text-slate-600 text-[7px] font-bold rounded uppercase tracking-tighter">
                  CLIENT
                </span>
                <span className="text-[9px] text-slate-400 font-medium italic truncate max-w-[150px]" title={row.company_name}>
                  {row.company_name}
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      label: 'Pass/Fail',
      key: 'pass_quantity',
      width: '10%',
      className: 'text-center align-middle',
      render: (val, row) => (
        <div className="flex flex-col items-center justify-center">
          <span className={`font-bold text-[11px] leading-tight ${row.status === 'PENDING' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {row.status === 'PENDING' ? 'Pending' : parseFloat(val || row.accepted_quantity || 0).toFixed(3)}
          </span>
          <span className="text-rose-500 text-[9px] font-medium leading-tight">Fail: {parseFloat(row.fail_quantity || 0).toFixed(3)}</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      width: '10%',
      className: 'text-center align-middle',
      render: (val) => (
        <div className="flex items-center justify-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-tighter ${qcStatusColors[val]?.badge}`}>
            {qcStatusColors[val]?.label || val}
          </span>
        </div>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      width: '35%',
      className: 'text-right align-middle',
      render: (val, row) => (
        <div className="flex justify-end items-center gap-1 flex-nowrap h-full">
          <button onClick={(e) => { e.stopPropagation(); handleViewQC(row); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-colors bg-white border border-slate-100" title="View Details">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEditQC(row); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded  transition-colors bg-white border border-slate-100" title="Edit Inspection">
            <Edit className="w-3.5 h-3.5" />
          </button>
          {activeTab === 'in-process' && (
            <>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (row.invoice_url) {
                    window.open(`${API_BASE}/${row.invoice_url}`, '_blank');
                  } else {
                    setUploadingQcId(row.id);
                    invoiceInputRef.current?.click();
                  }
                }} 
                className={`p-1.5 rounded  transition-colors bg-white border border-slate-100 ${row.invoice_url ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                title={row.invoice_url ? "View Invoice" : "Upload Invoice"}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); openEmailModal(row); }} 
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded  transition-colors bg-white border border-slate-100"
                title="Send Notification"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleCreatePO(row); }} 
                className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded  transition-colors bg-white border border-slate-100"
                title="Create PO"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleCreateStockEntry(row.id); }} 
                className="p-1.5 text-blue-500 hover:text-emerald-600 hover:bg-emerald-50 rounded  transition-colors bg-white border border-slate-100"
                title="Create Stock Entry"
              >
                <Database className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownloadPdf(row); }} 
                className="px-2 py-1 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100 rounded hover:bg-orange-100 transition-all active:scale-95"
              >
                QC Report
              </button>
            </>
          )}
          {['PASSED', 'ACCEPTED', 'SHORTAGE', 'OVERAGE'].includes(row.status) && activeTab !== 'in-process' && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleCreateStockEntry(row.id); }} 
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded  transition-colors bg-white border border-slate-100"
                title="Create Stock Entry"
              >
                <Database className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {['PASSED', 'FAILED', 'ACCEPTED', 'SHORTAGE', 'OVERAGE'].includes(row.status) && activeTab === 'final' && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDownloadPdf(row); }} 
              className="px-2 py-1 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100 rounded hover:bg-orange-100 transition-all active:scale-95"
            >
              QC Report
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); handleDeleteQC(row.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded  transition-colors bg-white border border-slate-100" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  const inspectionViewColumns = [
    {
      label: 'Item Details',
      key: 'material_name',
      render: (val, item) => (
        <div className="flex flex-col gap-0.5">
          <div className=" text-slate-900 text-xs ">{val || 'Unnamed Item'}</div>
          <div className="inline-flex items-center p-1 rounded-md bg-slate-100 text-slate-600 text-xs  w-fit tracking-tight border border-slate-200">
            {item.item_code}
          </div>
          {(item.length || item.width || item.thickness || item.diameter || item.outer_diameter) && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              {item.length > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">L: {parseFloat(item.length).toFixed(4)}</span>}
              {item.width > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">W: {parseFloat(item.width).toFixed(4)}</span>}
              {item.thickness > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">T: {parseFloat(item.thickness).toFixed(4)}</span>}
              {item.diameter > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">Dia: {parseFloat(item.diameter).toFixed(4)}</span>}
              {item.outer_diameter > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">OD: {parseFloat(item.outer_diameter).toFixed(4)}</span>}
            </div>
          )}
          {item.description && item.description !== val && (
            <div className="text-[8px] text-slate-400 truncate max-w-[180px] italic mt-0.5">
              {item.description}
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Warehouse',
      key: 'warehouse_name',
      render: (val) => (
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
          {val || '—'}
        </span>
      )
    },
    {
      label: 'Design Qty',
      key: 'design_qty',
      className: 'text-center',
      render: (val, item) => (
        <span className="text-xs text-slate-400">
          {parseFloat(item.planned_qty || val || 0).toFixed(3)}
          <span className="ml-1 text-xs  text-slate-300 uppercase">{item.uom || 'Nos'}</span>
        </span>
      )
    },
    {
      label: 'Required',
      key: 'ordered_qty',
      className: 'text-center',
      render: (val, item) => (
        <span className="text-xs text-slate-600">
          {parseFloat(val || 0).toFixed(3)}
          <span className="ml-1 text-xs  text-slate-400 uppercase">{item.uom || 'Nos'}</span>
        </span>
      )
    },
    {
      label: 'Received',
      key: 'received_qty',
      className: 'text-center',
      render: (val, item) => (
        <span className="text-xs text-slate-600">
          {parseFloat(val || 0).toFixed(3)}
          <span className="ml-1 text-xs  text-slate-400 uppercase">{item.uom || 'Nos'}</span>
        </span>
      )
    },
    {
      label: 'Accepted',
      key: 'accepted_qty',
      className: 'text-center',
      render: (val, item) => (
        selectedQC?.status === 'PENDING' ? 'Pending' : (
          <span className="text-xs text-emerald-600">
            {parseFloat(val || 0).toFixed(3)}
            <span className="ml-1 text-xs  text-emerald-300 uppercase">{item.uom || 'Nos'}</span>
          </span>
        )
      )
    }
  ];

  const inspectionEditColumns = [
    {
      label: 'Item Details',
      key: 'material_name',
      render: (val, item) => (
        <div className="flex flex-col gap-0.5">
          <div className=" text-slate-900 text-xs ">{val || item.item_code || 'Unnamed Item'}</div>
          <div className="inline-flex items-center p-1 rounded-md bg-slate-100 text-slate-600 text-xs  w-fit tracking-tight border border-slate-200">
            {item.item_code}
          </div>
          {(item.length || item.width || item.thickness || item.diameter || item.outer_diameter) && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              {item.length > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">L: {parseFloat(item.length).toFixed(4)}</span>}
              {item.width > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">W: {parseFloat(item.width).toFixed(4)}</span>}
              {item.thickness > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">T: {parseFloat(item.thickness).toFixed(4)}</span>}
              {item.diameter > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">Dia: {parseFloat(item.diameter).toFixed(4)}</span>}
              {item.outer_diameter > 0 && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 border border-slate-100 rounded">OD: {parseFloat(item.outer_diameter).toFixed(4)}</span>}
            </div>
          )}
          {item.description && item.description !== val && (
            <div className="text-[8px] text-slate-400 truncate max-w-[180px] italic mt-0.5">
              {item.description}
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Design Qty',
      key: 'design_qty',
      className: 'text-center',
      render: (val, item) => (
        <span className="text-xs text-slate-400">
          {parseFloat(item.planned_qty || val || 0).toFixed(3)}
          <span className="ml-1 text-xs  text-slate-300 uppercase">{item.uom || 'Nos'}</span>
        </span>
      )
    },
    {
      label: 'Required',
      key: 'ordered_qty',
      className: 'text-center',
      render: (val, item) => (
        <span className="text-xs text-slate-600">
          {parseFloat(val || 0).toFixed(3)}
          <span className="ml-1 text-xs  text-slate-400 uppercase">{item.uom || 'Nos'}</span>
        </span>
      )
    },
    {
      label: 'Invoice',
      key: 'received_qty',
      className: 'text-center',
      render: (val, item) => (
        <span className="text-xs text-slate-900">
          {parseFloat(val || 0).toFixed(3)}
          <span className="ml-1 text-xs  text-slate-400 uppercase">{item.uom || 'Nos'}</span>
        </span>
      )
    },
    {
      label: 'Received Quantity',
      key: 'accepted_qty',
      className: 'text-center',
      render: (val, item, idx) => (
        <div className="flex flex-col items-center gap-1">
          <input
            type="number"
            step="0.001"
            value={parseFloat(val || 0).toFixed(3)}
            onChange={(e) => handleItemQtyChange(idx, e.target.value)}
            className="w-24 p-2.5 bg-white border border-blue-200 rounded text-center text-xs text-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
          />
          <span className="text-xs  text-slate-400 uppercase">{item.uom || 'Nos'}</span>
        </div>
      )
    },
    {
      label: 'Shortage',
      key: 'shortage',
      className: 'text-center text-rose-500 ',
      render: (_, item) => {
        const shortage = Math.max(0, parseFloat(item.ordered_qty || 0) - parseFloat(item.accepted_qty || 0));
        return shortage > 0 ? (
          <span className="text-xs">
            {shortage.toFixed(3)}
            <span className="ml-1 text-[9px] uppercase">{item.uom || 'Nos'}</span>
          </span>
        ) : '0.000';
      }
    },
    {
      label: 'Overage',
      key: 'overage',
      className: 'text-center text-blue-500 ',
      render: (_, item) => {
        const overage = Math.max(0, parseFloat(item.accepted_qty || 0) - parseFloat(item.ordered_qty || 0));
        return overage > 0 ? (
          <span className="text-xs">
            {overage.toFixed(3)}
            <span className="ml-1 text-[9px] uppercase">{item.uom || 'Nos'}</span>
          </span>
        ) : '0.000';
      }
    },
    {
      label: 'Item Status',
      key: 'status',
      className: 'text-center whitespace-nowrap',
      render: (_, item) => {
        const shortage = Math.max(0, parseFloat(item.ordered_qty || 0) - parseFloat(item.accepted_qty || 0));
        const overage = Math.max(0, parseFloat(item.accepted_qty || 0) - parseFloat(item.ordered_qty || 0));
        if (shortage > 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 text-xs">SHORTAGE ✅</span>;
        if (overage > 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-xs">OVERAGE ✅</span>;
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs">AVAILABLE ✅</span>;
      }
    },
    {
      label: 'Item Notes',
      key: 'remarks',
      render: (val, _, idx) => (
        <input
          type="text"
          value={val || ''}
          onChange={(e) => handleItemRemarksChange(idx, e.target.value)}
          className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
          placeholder="Notes..."
        />
      )
    }
  ];

  const tabs = [
    { id: 'incoming', label: 'Incoming QC', icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'in-process', label: 'Partially QC', icon: Search, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'final', label: 'Final QC', icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const renderContent = () => {
    const pendingInspections = qcInspections.filter(q => q.status === 'PENDING');
    const inProgressInspections = qcInspections.filter(q => ['IN_PROGRESS', 'SHORTAGE', 'OVERAGE'].includes(q.status));
    const finalInspections = qcInspections.filter(q => ['PASSED', 'FAILED', 'ACCEPTED'].includes(q.status));

    switch (activeTab) {
      case 'incoming':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-white p-2 rounded  border border-slate-200 ">
                <p className="text-xs  text-slate-400   mb-1">Total Inspections</p>
                <p className="text-xl  text-slate-900">{stats?.totalInspections || qcInspections.length}</p>
              </div>
              <div className="bg-white p-2 rounded  border border-slate-200 ">
                <p className="text-xs  text-emerald-500   mb-1">Passed</p>
                <p className="text-2xl  text-emerald-600">{stats?.passed || 0}</p>
              </div>
              <div className="bg-white p-2 rounded  border border-slate-200 ">
                <p className="text-xs  text-red-500   mb-1">Failed</p>
                <p className="text-2xl  text-red-600">{stats?.failed || 0}</p>
              </div>
              <div className="bg-white p-2 rounded  border border-slate-200 ">
                <p className="text-xs  text-amber-500   mb-1">Pending</p>
                <p className="text-2xl  text-amber-600">{stats?.pending || 0}</p>
              </div>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs  text-slate-900">Incoming Inspection Queue</h3>
                <button 
                  onClick={() => { fetchQCInspections(); fetchStats(); }}
                  className="p-2 text-slate-500 hover:text-indigo-600 rounded  hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <DataTable
                columns={columns}
                data={pendingInspections}
                loading={loading}
                searchPlaceholder="Search by GRN or PO..."
              />
            </Card>
          </div>
        );
      case 'in-process':
        return (
          <div className="space-y-2">
            <Card title="Partially Quality Control" subtitle="Real-time production quality monitoring and line inspections">
              <div className="flex justify-end items-center gap-2 mb-4">
                <button 
                  onClick={() => handleBulkDownload(inProgressInspections)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded text-[10px] font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-100 uppercase tracking-wider"
                >
                  <FileText className="w-3 h-3" />
                  Generate QC Reports
                </button>
                <button 
                  onClick={() => { fetchQCInspections(); }}
                  className="p-2 text-slate-500 hover:text-indigo-600 rounded  hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <DataTable
                columns={columns}
                data={inProgressInspections}
                loading={loading}
                searchPlaceholder="Search by GRN or PO..."
              />
            </Card>
          </div>
        );
      case 'final':
        return (
          <div className="space-y-2">
            {finalInspections.length > 0 && (
              <Card 
                title="Completed Incoming Inspections" 
                subtitle="Recent raw material and component inspection results"
              >
                <div className="flex justify-end items-center gap-2 mb-4">
                  <button 
                    onClick={() => handleBulkDownload(finalInspections)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded text-[10px] font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-100 uppercase tracking-wider"
                  >
                    <FileText className="w-3 h-3" />
                    Generate QC Reports
                  </button>
                  <button 
                    onClick={() => { fetchQCInspections(); }}
                    className="p-2 text-slate-500 hover:text-indigo-600 rounded  hover:bg-slate-50 transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <DataTable
                  columns={columns}
                  data={finalInspections}
                  loading={loading}
                  searchPlaceholder="Search by GRN or PO..."
                />
              </Card>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl  text-slate-900">Quality Control</h1>
        <p className="text-sm text-slate-500">Manage raw material, in-process, and final quality inspections.</p>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => {
          const tabPath = id === 'incoming' ? '/incoming-qc' : `/incoming-qc/${id}`;
          navigate(tabPath);
        }}
        className="mb-4 border-none px-0"
      />

      <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
        {renderContent()}
      </div>

      <Modal
        isOpen={showViewModal}
        onClose={() => navigate(activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`)}
        title={`Inspection Details - GRN-${String(selectedQC?.grn_id).padStart(4, '0')}`}
        size="6xl"
      >
        {selectedQC && (
          <div className="space-y-2 p-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="p-2 bg-white rounded  border border-slate-100 ">
                <p className="text-xs  text-slate-400   mb-1.5">Status</p>
                <span className={`inline-flex items-center p-2  rounded text-xs    border ${qcStatusColors[selectedQC.status]?.badge}`}>
                  {qcStatusColors[selectedQC.status]?.label || selectedQC.status}
                </span>
              </div>
              <div className="p-2 bg-white rounded  border border-slate-100 ">
                <p className="text-xs  text-slate-400   mb-1.5">PO Number</p>
                <p className="text-xs  text-slate-900">{selectedQC.po_number || '—'}</p>
              </div>
              <div className="p-2 bg-white rounded  border border-slate-100 ">
                <p className="text-xs  text-emerald-500   mb-1.5">Pass Quantity</p>
                <p className="text-sm  text-emerald-600">
                  {selectedQC.status === 'PENDING' ? 'Pending' : parseFloat(selectedQC.pass_quantity || selectedQC.accepted_quantity || 0).toFixed(3)}
                </p>
              </div>
              <div className="p-2 bg-white rounded  border border-slate-100 ">
                <p className="text-xs  text-red-500   mb-1.5">Fail Quantity</p>
                <p className="text-sm  text-red-600">{parseFloat(selectedQC.fail_quantity || 0).toFixed(3)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center ">
                    <ListTodo className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs  text-slate-900  ">Items Verification</h4>
                    <p className="text-[8px] text-slate-400  ">Item wise quality check results</p>
                  </div>
                </div>
                
                <div className="bg-white rounded border border-slate-100 overflow-hidden ">
                  <DataTable
                    columns={inspectionViewColumns}
                    data={selectedQC.items_detail || []}
                    emptyMessage="No items found for this inspection."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-5 bg-amber-50/50 rounded border border-amber-100/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded  flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs  text-amber-700  ">Defects</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed  bg-white/50 p-2 rounded  border border-amber-50">
                    {selectedQC.defects || "No specific defects reported."}
                  </p>
                </div>

                <div className="p-5 bg-blue-50/50 rounded border border-blue-100/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded  flex items-center justify-center">
                      <Beaker className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs  text-blue-700  ">Remarks</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic  bg-white/50 p-2 rounded  border border-blue-50">
                    "{selectedQC.remarks || 'Auto-created inspection record.'}"
                  </p>
                </div>

                {/* View Attachments */}
                <div className="p-5 bg-slate-50/50 rounded border border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded flex items-center justify-center">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs text-slate-700 font-semibold uppercase">Attachments</h4>
                  </div>
                  <div className="space-y-2">
                    {attachments.length > 0 ? (
                      attachments.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-100 hover:border-indigo-200 transition-all">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={`${API_BASE}/${file.file_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-slate-600 hover:text-indigo-600 truncate flex-1"
                          >
                            {file.file_name}
                          </a>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">No attachments uploaded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-50">
              <button
                onClick={() => navigate(activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`)}
                className="px-8 py-2.5 bg-slate-900 text-white rounded  text-xs  hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => navigate(activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`)}
        title="QUALITY CONTROL INSPECTION"
        size="6xl"
      >
        <form onSubmit={handleUpdateQC} className="space-y-2 p-2">
          {/* Top Info */}
          <div className="bg-slate-50/50 p-2 rounded  border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="flex flex-col">
                  <span className="text-xs  text-slate-400  ">GRN Number</span>
                  <span className="text-xs  text-indigo-600">GRN-{String(selectedQC?.grn_id).padStart(4, '0')}</span>
               </div>
               <div className="h-8 w-px bg-slate-200"></div>
               <div className="flex flex-col">
                  <span className="text-xs  text-slate-400  ">PO Number</span>
                  <span className="text-xs  text-slate-700">{selectedQC?.po_number || '—'}</span>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-5 h-5 bg-white rounded  flex items-center justify-center text-slate-400 border border-slate-100 ">
                  <Clock className="w-5 h-5" />
               </div>
               <div className="text-right">
                  <p className="text-xs  text-slate-400  ">Inspection Date</p>
                  <p className="text-xs  text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <FormControl label="INSPECTION STATUS">
              <select
                className="w-full p-2 .5 bg-white rounded  border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all  text-xs text-slate-700  "
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                required
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">Partially</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="SHORTAGE">Shortage</option>
                <option value="OVERAGE">Overage</option>
              </select>
            </FormControl>
            <FormControl label="OVERALL REMARKS">
              <textarea
                className="w-full p-2  bg-white rounded  border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-xs "
                value={editFormData.remarks}
                onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                placeholder="General inspection notes..."
                rows="1"
              />
            </FormControl>
          </div>

          <div className="space-y-2">
             <div className="bg-white rounded border border-slate-100 overflow-hidden ">
                <DataTable
                  columns={inspectionEditColumns}
                  data={editFormData.items || []}
                  emptyMessage="No items to inspect."
                />
             </div>
          </div>

          {/* Attachments Section */}
          <div className="mt-4 p-4 bg-slate-50 rounded border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Inspection Attachments</h4>
              </div>
              <button
                type="button"
                onClick={() => attachmentsInputRef.current?.click()}
                disabled={isAttachmentsUploading}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isAttachmentsUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {isAttachmentsUploading ? 'Uploading...' : 'Add Attachments'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {attachments.length > 0 ? (
                attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 group hover:border-indigo-200 transition-all">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-1.5 bg-slate-50 text-slate-400 rounded group-hover:bg-indigo-50 group-hover:text-indigo-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <a
                        href={`${API_BASE}/${file.file_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-600 hover:text-indigo-600 truncate max-w-[150px]"
                      >
                        {file.file_name}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(file.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-4 text-center text-slate-400 text-xs italic">
                  No attachments found. Upload related documents or photos here.
                </div>
              )}
            </div>
            <input
              type="file"
              ref={attachmentsInputRef}
              className="hidden"
              multiple
              onChange={handleAttachmentsUpload}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <div>
              <p className="text-xs  text-slate-400  ">Total Received</p>
              <p className="text-xl  text-blue-600">{parseFloat(editFormData.passQuantity || 0).toFixed(3)} <span className="text-xs  text-slate-400">Units</span></p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`)}
                className="px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded  text-xs  hover:bg-slate-50 transition-all active:scale-95"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex items-center gap-2  px-8 py-2.5 bg-blue-600 text-white rounded  text-xs  hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                SAVE INSPECTION RESULTS
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Email Modal */}
      {showEmailModal && selectedQC && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-white rounded shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-2 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl  text-slate-800 tracking-tight">Send QC Alert to Vendor</h2>
                  <p className="text-xs text-slate-400   ">GRN-{String(selectedQC.grn_id).padStart(4, '0')} • {selectedQC.vendor_name || 'Vendor'}</p>
                </div>
              </div>
              <button 
                onClick={() => navigate(activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-5">
              <div className="space-y-2">
                <FormControl label="Recipient Email *">
                  <input
                    type="email"
                    value={emailData.to}
                    onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                    placeholder="vendor@example.com"
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </FormControl>

                <FormControl label="Subject">
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                    className="w-full p-2 .5 bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    required
                  />
                </FormControl>

                <FormControl label="Message">
                  <textarea
                    value={emailData.message}
                    onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                    rows="8"
                    className="w-full p-2  bg-slate-50 border border-slate-200 rounded  text-sm  text-slate-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    required
                  />
                </FormControl>

                <div className="flex items-center gap-2 p-2 bg-emerald-50/50 border border-emerald-100 rounded ">
                  <div className="p-2 bg-emerald-500 text-white rounded ">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs  text-emerald-700  ">Attachment</p>
                    <p className="text-xs  text-emerald-600">QC_Report_GRN-{String(selectedQC.grn_id).padStart(4, '0')}.pdf</p>
                  </div>
                  <div className="flex items-center gap-2 ">
                    <input
                      type="checkbox"
                      id="attachPDF"
                      checked={emailData.attachPDF}
                      onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <label htmlFor="attachPDF" className="text-xs  text-slate-500  ">Include</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => navigate(activeTab === 'incoming' ? '/incoming-qc' : `/incoming-qc/${activeTab}`)}
                  className="p-2 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2  px-8 py-2.5 bg-blue-600 text-white rounded  text-sm  hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {loading ? 'Sending...' : 'Send Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={invoiceInputRef}
        className="hidden"
        accept="application/pdf,image/*"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default IncomingQC;
