import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, DataTable, Modal, FormControl } from '../components/ui.jsx';
import { Beaker, Clock, Inbox, Search, CheckCircle2, Eye, Edit, Trash2, ListTodo, AlertTriangle, RefreshCw, X, CheckCircle, XCircle, ShieldCheck, Mail, Paperclip, Send, Database, ShoppingCart, Truck } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const qcStatusColors = {
  PENDING: { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
  IN_PROGRESS: { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
  PASSED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Passed' },
  FAILED: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' },
  SHORTAGE: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Shortage' },
  OVERAGE: { badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Overage' },
  ACCEPTED: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Accepted' }
};

const IncomingQC = ({ initialTab = 'incoming' }) => {
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
  const [editFormData, setEditFormData] = useState({
    status: '',
    remarks: '',
    defects: '',
    passQuantity: '',
    failQuantity: '',
    items: []
  });

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
    setSelectedQC(qc);
    setShowViewModal(true);
  };

  const handleEditQC = (qc) => {
    setSelectedQC(qc);
    const items = (qc.items_detail || []).map(item => ({
      ...item,
      accepted_qty: item.accepted_qty || item.received_qty || 0,
      rejected_qty: item.rejected_qty || 0,
      remarks: item.remarks || ''
    }));

    // Calculate initial status based on items
    let hasShortageOverage = false;

    items.forEach(item => {
      const ordQty = parseFloat(item.ordered_qty || 0);
      const accQty = parseFloat(item.accepted_qty || 0);
      
      const discrepancy = Math.abs(ordQty - accQty);

      if (discrepancy > 0.001) {
        hasShortageOverage = true;
      }
    });

    let overallStatus = qc.status || 'PENDING';
    if (hasShortageOverage) {
      overallStatus = 'IN_PROGRESS';
    } else if (overallStatus !== 'PENDING') {
      overallStatus = 'PASSED';
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
    
    // Calculate Overall Status based on Items
    let hasShortageOverage = false;

    newItems.forEach(item => {
      const ordQty = parseFloat(item.ordered_qty || 0);
      const accQty = parseFloat(item.accepted_qty || 0);
      
      const discrepancy = Math.abs(ordQty - accQty);

      if (discrepancy > 0.001) {
        hasShortageOverage = true;
      }
    });

    let overallStatus = 'PASSED';
    if (hasShortageOverage) {
      overallStatus = 'IN_PROGRESS';
    } else {
      overallStatus = 'PASSED';
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
    try {
      setSelectedQC(qc);
      const shortageItems = (qc.items_detail || []).filter(item => (parseFloat(item.received_qty) || 0) > (parseFloat(item.accepted_qty) || 0));
      const overageItems = (qc.items_detail || []).filter(item => (parseFloat(item.accepted_qty) || 0) > (parseFloat(item.received_qty) || 0));
      
      let message = `Dear ${qc.vendor_name || 'Vendor'},\n\nThis is a notification regarding the Quality Control Inspection for GRN-${String(qc.grn_id).padStart(4, '0')} (PO: ${qc.po_number || 'N/A'}).\n\n`;
      
      if (shortageItems.length > 0) {
        message += `Shortage detected in the following items:\n`;
        shortageItems.forEach(item => {
          const diff = (parseFloat(item.received_qty) || 0) - (parseFloat(item.accepted_qty) || 0);
          message += `- ${item.material_name || item.item_code}: Shortage of ${diff.toFixed(2)} ${item.unit || 'units'}\n`;
        });
        message += `\n`;
      }
      
      if (overageItems.length > 0) {
        message += `Overage detected in the following items:\n`;
        overageItems.forEach(item => {
          const diff = (parseFloat(item.accepted_qty) || 0) - (parseFloat(item.received_qty) || 0);
          message += `- ${item.material_name || item.item_code}: Overage of ${diff.toFixed(2)} ${item.unit || 'units'}\n`;
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

  const handleCreateShipment = async (qc) => {
    const result = await Swal.fire({
      title: 'Create Shipment Order?',
      text: `This will generate a shipment order for GRN-${String(qc.grn_id).padStart(4, '0')}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Create',
      cancelButtonColor: '#4f46e5',
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        // Note: This endpoint might need to be adjusted based on backend capabilities for Incoming QC
        const response = await fetch(`${API_BASE}/qc-inspections/${qc.id}/create-shipment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          successToast(`Shipment Order ${data.shipmentCode || ''} created successfully`);
          fetchQCInspections();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create shipment');
        }
      } catch (error) {
        errorToast(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const columns = [
    {
      label: 'GRN #',
      key: 'grn_id',
      sortable: true,
      render: (val) => (
        <span className="   text-indigo-600">
          {val ? `GRN-${String(val).padStart(4, '0')}` : '—'}
        </span>
      )
    },
    {
      label: 'PO #',
      key: 'po_number',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-slate-900">{val || '—'}</div>
          <div className="text-[10px] text-slate-500">{row.vendor_name || '—'}</div>
        </div>
      )
    },
    {
      label: 'Pass/Fail',
      key: 'pass_quantity',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex flex-col items-end">
          <span className={`${row.status === 'PENDING' ? 'text-amber-600' : 'text-emerald-600'} `}>
            {row.status === 'PENDING' ? 'Pending' : parseFloat(val || row.accepted_quantity || 0).toFixed(3)}
          </span>
          <span className="text-red-500text-xs ">Fail: {parseFloat(row.fail_quantity || 0).toFixed(3)}</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs    border ${qcStatusColors[val]?.badge}`}>
          {qcStatusColors[val]?.label || val}
        </span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (val, row) => (
        <div className="flex justify-end gap-1.5 transition-opacity">
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
            </>
          )}
          {['PASSED', 'ACCEPTED', 'SHORTAGE', 'OVERAGE'].includes(row.status) && activeTab !== 'in-process' && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleCreateStockEntry(row.id); }} 
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors bg-white border border-slate-100"
                title="Create Stock Entry"
              >
                <Database className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={(e) => { e.stopPropagation(); handleDeleteQC(row.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded  transition-colors bg-white border border-slate-100" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  const tabs = [
    { id: 'incoming', label: 'Incoming QC', icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'in-process', label: 'In-Process QC', icon: Search, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'final', label: 'Final QC', icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const renderContent = () => {
    const pendingInspections = qcInspections.filter(q => q.status === 'PENDING');
    const inProgressInspections = qcInspections.filter(q => q.status === 'IN_PROGRESS');
    const finalInspections = qcInspections.filter(q => ['PASSED', 'FAILED', 'ACCEPTED', 'SHORTAGE', 'OVERAGE'].includes(q.status));

    switch (activeTab) {
      case 'incoming':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded  border border-slate-200 ">
                <p className="text-[10px]  text-slate-400   mb-1">Total Inspections</p>
                <p className="text-2xl  text-slate-900">{stats?.totalInspections || qcInspections.length}</p>
              </div>
              <div className="bg-white p-4 rounded  border border-slate-200 ">
                <p className="text-[10px]  text-emerald-500   mb-1">Passed</p>
                <p className="text-2xl  text-emerald-600">{stats?.passed || 0}</p>
              </div>
              <div className="bg-white p-4 rounded  border border-slate-200 ">
                <p className="text-[10px]  text-red-500   mb-1">Failed</p>
                <p className="text-2xl  text-red-600">{stats?.failed || 0}</p>
              </div>
              <div className="bg-white p-4 rounded  border border-slate-200 ">
                <p className="text-[10px]  text-amber-500   mb-1">Pending</p>
                <p className="text-2xl  text-amber-600">{stats?.pending || 0}</p>
              </div>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm  text-slate-900">Incoming Inspection Queue</h3>
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
          <div className="space-y-4">
            <Card title="In-Process Quality Control" subtitle="Real-time production quality monitoring and line inspections">
              <div className="flex justify-end mb-4">
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
          <div className="space-y-6">
            {finalInspections.length > 0 && (
              <Card 
                title="Completed Incoming Inspections" 
                subtitle="Recent raw material and component inspection results"
              >
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
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl  text-slate-900">Quality Control</h1>
        <p className="text-sm text-slate-500">Manage raw material, in-process, and final quality inspections.</p>
      </div>

      <div className="flex items-center gap-2  p-1 bg-slate-100 rounded  w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2  p-2  text-sm  transition-all duration-200 rounded  ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 '
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
        {renderContent()}
      </div>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={`Inspection Details - GRN-${String(selectedQC?.grn_id).padStart(4, '0')}`}
        size="6xl"
      >
        {selectedQC && (
          <div className="space-y-8 p-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded  border border-slate-100 ">
                <p className="text-[10px] font-black text-slate-400  tracking-widest mb-1.5">Status</p>
                <span className={`inline-flex items-center p-2  rounded text-xs  font-black  border ${qcStatusColors[selectedQC.status]?.badge}`}>
                  {qcStatusColors[selectedQC.status]?.label || selectedQC.status}
                </span>
              </div>
              <div className="p-4 bg-white rounded  border border-slate-100 ">
                <p className="text-[10px] font-black text-slate-400  tracking-widest mb-1.5">PO Number</p>
                <p className="text-sm font-black text-slate-900">{selectedQC.po_number || '—'}</p>
              </div>
              <div className="p-4 bg-white rounded  border border-slate-100 ">
                <p className="text-[10px] font-black text-emerald-500  tracking-widest mb-1.5">Pass Quantity</p>
                <p className="text-sm font-black text-emerald-600">
                  {selectedQC.status === 'PENDING' ? 'Pending' : (selectedQC.pass_quantity || selectedQC.accepted_quantity || 0)}
                </p>
              </div>
              <div className="p-4 bg-white rounded  border border-slate-100 ">
                <p className="text-[10px] font-black text-red-500  tracking-widest mb-1.5">Fail Quantity</p>
                <p className="text-sm font-black text-red-600">{selectedQC.fail_quantity || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded  flex items-center justify-center ">
                    <ListTodo className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900  tracking-widest">Items Verification</h4>
                    <p className="text-[8px] text-slate-400  ">Item wise quality check results</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden ">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80">
                      <tr className="text-[10px] font-black text-slate-500  tracking-widest border-b border-slate-200">
                        <th className="p-2 ">Item Details</th>
                        <th className="px-4 py-4">Warehouse</th>
                        <th className="px-4 py-4 text-center">Design Qty</th>
                        <th className="px-4 py-4 text-center">Received</th>
                        <th className="px-4 py-4 text-center">Accepted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedQC.items_detail?.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50/30 transition-all">
                          <td className="p-2 ">
                            <div className="flex flex-col gap-0.5">
                              <div className="font-black text-slate-900 text-xs">{item.material_name || 'Unnamed Item'}</div>
                              <div className="inline-flex items-center p-1  rounded-md bg-slate-100 text-slate-600text-xs    w-fit tracking-tight border border-slate-200">
                                {item.item_code}
                              </div>
                              {item.description && (
                                <div className="text-[8px] text-slate-400  truncate max-w-[180px] italic mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-[10px] font-black text-slate-500  bg-slate-100 px-2 py-1 rounded  border border-slate-200">
                              {item.warehouse_name || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-black text-slate-400 text-xs">{parseFloat(item.ordered_qty || 0).toFixed(3)}</td>
                          <td className="px-4 py-4 text-center font-black text-slate-600 text-xs">{parseFloat(item.received_qty || 0).toFixed(3)}</td>
                          <td className="px-4 py-4 text-center font-black text-emerald-600 text-xs">
                            {selectedQC.status === 'PENDING' ? 'Pending' : parseFloat(item.accepted_qty || 0).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-100/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded  flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black text-amber-700  tracking-widest">Defects</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed  bg-white/50 p-4 rounded  border border-amber-50">
                    {selectedQC.defects || "No specific defects reported."}
                  </p>
                </div>

                <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded  flex items-center justify-center">
                      <Beaker className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black text-blue-700  tracking-widest">Remarks</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic  bg-white/50 p-4 rounded  border border-blue-50">
                    "{selectedQC.remarks || 'Auto-created inspection record.'}"
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-50">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-8 py-2.5 bg-slate-900 text-white rounded  text-xs font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="QUALITY CONTROL INSPECTION"
        size="6xl"
      >
        <form onSubmit={handleUpdateQC} className="space-y-6 p-2">
          {/* Top Info */}
          <div className="bg-slate-50/50 p-4 rounded  border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400  tracking-widest">GRN Number</span>
                  <span className="text-xs font-black text-indigo-600">GRN-{String(selectedQC?.grn_id).padStart(4, '0')}</span>
               </div>
               <div className="h-8 w-px bg-slate-200"></div>
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400  tracking-widest">PO Number</span>
                  <span className="text-xs font-black text-slate-700">{selectedQC?.po_number || '—'}</span>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-white rounded  flex items-center justify-center text-slate-400 border border-slate-100 ">
                  <Clock className="w-5 h-5" />
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400  tracking-widest">Inspection Date</p>
                  <p className="text-xs font-black text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormControl label="INSPECTION STATUS">
              <select
                className="w-full p-2 .5 bg-white rounded  border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-xs text-slate-700  "
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                required
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
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

          <div className="space-y-4">
             <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden ">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/80">
                    <tr className="text-[10px] font-black text-slate-500  tracking-widest border-b border-slate-200">
                      <th className="p-2 ">Item Details</th>
                      <th className="px-4 py-4 text-center">Ordered</th>
                      <th className="px-4 py-4 text-center">Invoice</th>
                      <th className="px-4 py-4 text-center">Received Quantity</th>
                      <th className="px-4 py-4 text-center text-rose-500">Shortage</th>
                      <th className="px-4 py-4 text-center text-blue-500">Overage</th>
                      <th className="px-4 py-4 text-center">Item Status</th>
                      <th className="p-2 ">Item Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {editFormData.items.map((item, idx) => {
                      const shortage = Math.max(0, parseFloat(item.ordered_qty || 0) - parseFloat(item.accepted_qty || 0));
                      const overage = Math.max(0, parseFloat(item.accepted_qty || 0) - parseFloat(item.ordered_qty || 0));
                      
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/30 transition-all">
                          <td className="p-2 ">
                            <div className="flex flex-col gap-0.5">
                              <div className="font-black text-slate-900 text-xs">{item.material_name || item.item_code || 'Unnamed Item'}</div>
                              <div className="inline-flex items-center p-1  rounded-md bg-slate-100 text-slate-600text-xs    w-fit tracking-tight border border-slate-200">
                                {item.item_code}
                              </div>
                              {item.description && (
                                <div className="text-[8px] text-slate-400  truncate max-w-[180px] italic mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-black text-slate-400 text-xs">
                            {parseFloat(item.ordered_qty || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-center font-black text-slate-900 text-xs">
                            {parseFloat(item.received_qty || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-center">
                              <input
                                type="number"
                                value={item.accepted_qty}
                                onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                                className="w-20 p-2 .5 bg-white border border-blue-200 rounded  text-center text-xs font-black text-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all "
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-black text-rose-500 text-xs">
                            {shortage > 0 ? shortage.toFixed(0) : '0'}
                          </td>
                          <td className="px-4 py-4 text-center font-black text-blue-500 text-xs">
                            {overage > 0 ? overage.toFixed(0) : '0'}
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {shortage > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded  bg-rose-50 text-rose-600 border border-rose-100 text-[9px]  font-black   ">
                                SHORTAGE ✅
                              </span>
                            ) : overage > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded  bg-orange-50 text-orange-600 border border-orange-100 text-[9px]  font-black   ">
                                OVERAGE ✅
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded  bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px]  font-black   ">
                                AVAILABLE ✅
                              </span>
                            )}
                          </td>
                          <td className="p-2 ">
                             <input
                               type="text"
                               value={item.remarks}
                               onChange={(e) => handleItemRemarksChange(idx, e.target.value)}
                               placeholder="Defects etc..."
                               className="w-full bg-transparenttext-xs   text-slate-500 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-slate-200 pb-1"
                             />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400  tracking-widest">Total Received</p>
              <p className="text-xl font-black text-blue-600">{editFormData.passQuantity} <span className="text-xs  text-slate-400">Units</span></p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded  text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex items-center gap-2  px-8 py-2.5 bg-blue-600 text-white rounded  text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl my-auto animate-in fade-in zoom-in duration-200 overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-6 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl  text-slate-800 tracking-tight">Send QC Alert to Vendor</h2>
                  <p className="text-[10px] text-slate-400   tracking-widest">GRN-{String(selectedQC.grn_id).padStart(4, '0')} • {selectedQC.vendor_name || 'Vendor'}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-slate-100 rounded  transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-5">
              <div className="space-y-4">
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

                <div className="flex items-center gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded ">
                  <div className="p-2 bg-emerald-500 text-white rounded ">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-700  ">Attachment</p>
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
                    <label htmlFor="attachPDF" className="text-[10px]  text-slate-500  ">Include</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="p-2.5 border border-slate-200 text-slate-600 rounded  text-sm  hover:bg-slate-50 transition-all "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2  px-8 py-2.5 bg-blue-600 text-white rounded  text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
