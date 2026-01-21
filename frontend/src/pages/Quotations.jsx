import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const rfqStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  RECEIVED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Received' },
  REVIEWED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700', label: 'Reviewed' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Closed' },
  PENDING: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const daysValid = (validUntil) => {
  if (!validUntil) return null;
  const today = new Date();
  const valid = new Date(validUntil);
  const diff = Math.ceil((valid - today) / (1000 * 60 * 60 * 24));
  return diff;
};

const Quotations = () => {
  const [activeTab, setActiveTab] = useState('sent');
  const [quotations, setQuotations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Quotations');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [formData, setFormData] = useState({
    vendorId: '',
    salesOrderId: '',
    validUntil: '',
    notes: '',
    items: [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
  });
  const [recordData, setRecordData] = useState({
    projectId: '',
    vendorId: '',
    quotationId: '',
    amount: 0,
    validUntil: '',
    items: [],
    notes: ''
  });
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    message: '',
    attachPDF: true
  });
  const [editFormData, setEditFormData] = useState({
    vendorId: '',
    validUntil: '',
    items: []
  });

  useEffect(() => {
    fetchQuotations();
    fetchStats();
    fetchVendors();
    fetchSalesOrders();
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch quotations');
      const data = await response.json();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/incoming`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSalesOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
    });
  };

  const handleSalesOrderChange = async (e) => {
    const soId = e.target.value;
    const selectedSO = salesOrders.find(so => String(so.id) === String(soId));
    
    let targetDate = '';
    if (selectedSO && selectedSO.target_dispatch_date) {
      // Format YYYY-MM-DD for date input
      targetDate = new Date(selectedSO.target_dispatch_date).toISOString().split('T')[0];
    }

    setFormData({ 
      ...formData, 
      salesOrderId: soId,
      validUntil: targetDate || formData.validUntil 
    });

    if (!soId) {
      setFormData(prev => ({
        ...prev,
        items: [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
      }));
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${soId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const items = await response.json();
        
        // Flatten materials into line items for the RFQ
        const materialItems = [];
        items.forEach(item => {
          if (item.materials && item.materials.length > 0) {
            item.materials.forEach(mat => {
              materialItems.push({
                drawing_no: item.item_code || '', // Reference the parent drawing
                description: item.description || '',
                material_name: mat.material_name || '',
                material_type: mat.material_type || '',
                quantity: (parseFloat(item.quantity) * parseFloat(mat.qty_per_pc)) || 0,
                uom: mat.uom || 'NOS',
                unit_rate: 0
              });
            });
          }
        });

        setFormData(prev => ({
          ...prev,
          items: materialItems.length > 0 ? materialItems : [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
        }));
      }
    } catch (error) {
      console.error('Error fetching sales order items:', error);
    }
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleRecordProjectChange = (projectId) => {
    setRecordData({
      ...recordData,
      projectId,
      vendorId: '',
      quotationId: '',
      items: [],
      amount: 0,
      notes: ''
    });
  };

  const handleRecordVendorChange = async (vendorId) => {
    // Find the quotation for this project and vendor
    const quotation = quotations.find(q => 
      String(q.sales_order_id) === String(recordData.projectId) && 
      String(q.vendor_id) === String(vendorId) &&
      ['SENT', 'DRAFT'].includes(q.status)
    );

    if (quotation) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/quotations/${quotation.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const detailedQuotation = await response.json();
          setRecordData({
            ...recordData,
            vendorId,
            quotationId: quotation.id,
            items: detailedQuotation.items || [],
            amount: detailedQuotation.total_amount || 0,
            validUntil: detailedQuotation.valid_until ? new Date(detailedQuotation.valid_until).toISOString().split('T')[0] : '',
            notes: `Response to ${quotation.quote_number}`
          });
        }
      } catch (error) {
        console.error('Error fetching quotation details:', error);
      }
    } else {
      setRecordData({
        ...recordData,
        vendorId,
        quotationId: '',
        items: [],
        amount: 0,
        notes: ''
      });
    }
  };

  const handleRecordItemChange = (index, field, value) => {
    const newItems = [...recordData.items];
    newItems[index][field] = value;
    
    // Recalculate total amount
    const totalAmount = newItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.unit_rate) || 0;
      return sum + (qty * rate);
    }, 0);
    
    setRecordData({ 
      ...recordData, 
      items: newItems,
      amount: totalAmount
    });
  };

  const handleRecordAddEmptyItem = () => {
    setRecordData({
      ...recordData,
      items: [...recordData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
    });
  };

  const handleRecordRemoveItem = (index) => {
    const newItems = recordData.items.filter((_, i) => i !== index);
    const totalAmount = newItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.unit_rate) || 0;
      return sum + (qty * rate);
    }, 0);
    setRecordData({
      ...recordData,
      items: newItems,
      amount: totalAmount
    });
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();

    if (!formData.vendorId) {
      Swal.fire('Error', 'Vendor is required', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          vendorId: parseInt(formData.vendorId),
          salesOrderId: formData.salesOrderId ? parseInt(formData.salesOrderId) : null
        })
      });

      if (!response.ok) throw new Error('Failed to create quotation');

      await Swal.fire('Success', 'Quotation created successfully', 'success');
      setShowCreateModal(false);
      setFormData({
        vendorId: '',
        salesOrderId: '',
        validUntil: '',
        notes: '',
        items: [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
      });
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to create quotation', 'error');
    }
  };

  const handleRecordQuote = async (e) => {
    e.preventDefault();

    if (!recordData.quotationId) {
      Swal.fire('Error', 'Select a project and vendor to identify the quotation', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      // Update the quotation with received items and rates
      const response = await fetch(`${API_BASE}/quotations/${recordData.quotationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validUntil: recordData.validUntil,
          items: recordData.items,
          notes: recordData.notes
        })
      });

      if (!response.ok) throw new Error('Failed to record quote details');

      // Update status to RECEIVED
      await fetch(`${API_BASE}/quotations/${recordData.quotationId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'RECEIVED' })
      });

      await Swal.fire('Success', 'Quote details recorded successfully', 'success');
      setShowCreateModal(false);
      setRecordData({ projectId: '', vendorId: '', quotationId: '', amount: 0, validUntil: '', items: [], notes: '' });
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to record quote', 'error');
    }
  };

  const handleViewPDF = (quotationId) => {
    const pdfUrl = `${API_BASE}/quotations/${quotationId}/pdf`;
    window.open(pdfUrl, '_blank');
  };

  const handleApproveQuote = async (quotationId) => {
    const result = await Swal.fire({
      title: 'Approve Quote?',
      text: 'This will enable PO creation for this quotation',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'REVIEWED' })
      });

      if (!response.ok) throw new Error('Failed to approve quote');

      await Swal.fire('Success', 'Quote approved successfully', 'success');
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to approve quote', 'error');
    }
  };

  const handleDeleteQuotation = async (quotationId) => {
    const result = await Swal.fire({
      title: 'Delete Quotation?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${quotationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete quotation');
      }

      await Swal.fire('Success', 'Quotation deleted successfully', 'success');
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to delete quotation', 'error');
    }
  };

  const openEmailModal = (quotation) => {
    const vendor = vendors.find(v => v.id === quotation.vendor_id);
    setSelectedQuotation(quotation);
    setEmailData({
      to: vendor?.email || '',
      subject: `Quotation Request - ${quotation.quote_number}`,
      message: `Dear ${vendor?.vendor_name},\n\nPlease find the attached quotation request.\n\nBest regards`,
      attachPDF: true
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();

    if (!emailData.to) {
      Swal.fire('Error', 'Recipient email is required', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          attachPDF: emailData.attachPDF
        })
      });

      if (!response.ok) throw new Error('Failed to send email');

      await fetch(`${API_BASE}/quotations/${selectedQuotation.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'SENT' })
      });

      await Swal.fire('Success', 'Email sent to vendor successfully', 'success');
      setShowEmailModal(false);
      setEmailData({ to: '', subject: '', message: '', attachPDF: true });
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to send email', 'error');
    }
  };

  const openEditModal = (quotation) => {
    setSelectedQuotation(quotation);
    // Map backend item fields to frontend BOM fields
    const mappedItems = (quotation.items || []).map(item => ({
      drawing_no: item.item_code || '',
      description: item.description || '',
      material_name: item.material_name || '',
      material_type: item.material_type || '',
      quantity: item.quantity || 0,
      uom: item.unit || 'NOS',
      unit_rate: item.unit_rate || 0
    }));

    setEditFormData({
      vendorId: quotation.vendor_id,
      validUntil: quotation.valid_until ? new Date(quotation.valid_until).toISOString().split('T')[0] : '',
      items: mappedItems.length > 0 ? mappedItems : [{ drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
    });
    setShowEditModal(true);
  };

  const handleEditQuotation = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${selectedQuotation.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: parseInt(editFormData.vendorId),
          validUntil: editFormData.validUntil,
          items: editFormData.items
        })
      });

      if (!response.ok) throw new Error('Failed to update quotation');

      await Swal.fire('Success', 'Quotation updated successfully', 'success');
      setShowEditModal(false);
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update quotation', 'error');
    }
  };

  const filteredQuotations = quotations.filter(q => {
    const isTabMatch = activeTab === 'sent' 
      ? true // Show all in Sent Requests for history
      : ['RECEIVED', 'REVIEWED', 'PENDING'].includes(q.status);

    const matchesSearch = q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All Quotations' || q.status === filterStatus;

    return isTabMatch && matchesSearch && matchesStatus;
  });

  const getVendorName = (vendorId) => {
    return vendors.find(v => v.id === vendorId)?.vendor_name || 'Unknown Vendor';
  };

  return (
    <div className="space-y-3">
      <Card title="Vendor Quotations" subtitle="Manage and compare vendor quotes">
        <div className="flex gap-4 justify-between items-center mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search quote number, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All Quotations">All Quotations</option>
            <option value="SENT">Sent</option>
            <option value="RECEIVED">Received</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="PENDING">Pending</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm  hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {activeTab === 'sent' ? 'Request Quote' : 'Record Quote'}
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm  hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 px-1 text-sm  transition ${
              activeTab === 'sent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sent Requests (RFQ)
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`pb-3 px-1 text-sm  transition ${
              activeTab === 'received'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Received Quotes
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading quotations...</p>
        ) : filteredQuotations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No quotations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left ">Quote No.</th>
                  <th className="px-4 py-3 text-left ">Vendor</th>
                  <th className="px-4 py-3 text-left ">{activeTab === 'sent' ? 'Valid Till' : 'Total Amount'}</th>
                  <th className="px-4 py-3 text-left ">Status</th>
                  <th className="px-4 py-3 text-right ">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((q) => (
                  <tr key={`quote-${q.id}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      <div className="text-sm">{q.quote_number}</div>
                      {q.sales_order_id && (
                        <div className="text-xs text-slate-500 mt-1">Ref: SO-{q.sales_order_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{getVendorName(q.vendor_id)}</td>
                    <td className="px-4 py-4">
                      {activeTab === 'sent' ? (
                        <div className="flex items-center gap-2">
                          <span>{formatDate(q.valid_until)}</span>
                          {q.valid_until && (
                            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                              {daysValid(q.valid_until)} days valid
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="">{formatCurrency(q.total_amount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs  ${rfqStatusColors[q.status]?.badge}`}>
                        {rfqStatusColors[q.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewPDF(q.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          title="View Quotation PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {activeTab === 'sent' && (
                          <>
                            <button
                              onClick={() => openEmailModal(q)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                              title={q.status === 'SENT' ? 'Resend RFQ' : 'Send RFQ'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openEditModal(q)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                              title="Edit quotation"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </>
                        )}
                        {activeTab === 'received' && q.status === 'RECEIVED' && (
                          <button
                            onClick={() => handleApproveQuote(q.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                            title="Approve Quote"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteQuotation(q.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600   tracking-wider mb-1">Total Quotations</p>
            <p className="text-2xl  text-blue-900">{stats.total_quotations || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600   tracking-wider mb-1">Pending Quotes</p>
            <p className="text-2xl  text-yellow-900">{stats.pending_quotations || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600   tracking-wider mb-1">Approved Quotes</p>
            <p className="text-2xl  text-emerald-900">{stats.approved_quotations || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-600   tracking-wider mb-1">Total Value</p>
            <p className="text-2xl  text-purple-900">{formatCurrency(stats.total_value)}</p>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-md text-slate-900 text-xs">
                  {activeTab === 'sent' ? 'Create Quote Request (RFQ)' : 'Record Vendor Quote'}
                </h3>
                {activeTab !== 'sent' && (
                  <p className="text-xs text-slate-500 mt-1">Record details from vendor response</p>
                )}
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={activeTab === 'sent' ? handleCreateQuotation : handleRecordQuote} className="">
              {activeTab === 'sent' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Project (Optional)</label>
                      <select
                        value={formData.salesOrderId}
                        onChange={handleSalesOrderChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Project to Load Requirements</option>
                        {salesOrders.map(so => (
                          <option key={so.id} value={so.id}>{so.project_name || `SO-${so.id}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
                      <select
                        value={formData.vendorId}
                        onChange={(e) => setFormData({...formData, vendorId: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">-- Select a Vendor --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-slate-700">Line Items</label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700"
                      >
                        + Add Item
                      </button>
                    </div>

                    {formData.items.length === 0 ? (
                      <p className="text-xs text-slate-500 p-4 text-center border border-dashed border-slate-200 rounded">
                        No items added yet. Click "Add Item" to include line items in this quotation.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-[10px]  text-slate-500  tracking-wider">
                          <div className="col-span-2">Drawing No</div>
                          <div className="col-span-3">Description</div>
                          <div className="col-span-3">Material Name</div>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-1">Qty</div>
                          <div className="col-span-1"></div>
                        </div>
                        {formData.items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Drawing No"
                              value={item.drawing_no}
                              onChange={(e) => handleItemChange(idx, 'drawing_no', e.target.value)}
                              className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              className="col-span-3 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Material Name"
                              value={item.material_name}
                              onChange={(e) => handleItemChange(idx, 'material_name', e.target.value)}
                              className="col-span-3 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Type"
                              value={item.material_type}
                              onChange={(e) => handleItemChange(idx, 'material_type', e.target.value)}
                              className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="col-span-1 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Add any notes"
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Project</label>
                      <select
                        value={recordData.projectId}
                        onChange={(e) => handleRecordProjectChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select Project to Filter Quotes --</option>
                        {salesOrders.map(so => (
                          <option key={so.id} value={so.id}>{so.project_name || `SO-${so.id}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
                      <select
                        value={recordData.vendorId}
                        onChange={(e) => handleRecordVendorChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={!recordData.projectId}
                      >
                        <option value="">-- Select a Vendor --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="block text-xs  text-slate-500  tracking-wider mb-1">Total Amount (₹)</label>
                      <div className="text-xl text-slate-900">{formatCurrency(recordData.amount)}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                      <input
                        type="date"
                        value={recordData.validUntil}
                        onChange={(e) => setRecordData({...recordData, validUntil: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-slate-700">Line Items</label>
                      <button
                        type="button"
                        onClick={handleRecordAddEmptyItem}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700"
                      >
                        + Add Item
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2  text-slate-600">DESCRIPTION</th>
                            <th className="px-3 py-2  text-slate-600">MATERIAL NAME</th>
                            <th className="px-3 py-2  text-slate-600" style={{ width: '100px' }}>TYPE</th>
                            <th className="px-3 py-2 text-center  text-slate-600" style={{ width: '70px' }}>QTY</th>
                            <th className="px-3 py-2 text-center  text-slate-600" style={{ width: '100px' }}>PRICE</th>
                            <th className="px-3 py-2 text-right  text-slate-600" style={{ width: '100px' }}>TOTAL</th>
                            <th className="px-3 py-2 text-center" style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recordData.items.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="px-3 py-8 text-center text-slate-400">
                                Select a project and vendor to load items, or add manually.
                              </td>
                            </tr>
                          ) : (
                            recordData.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => handleRecordItemChange(idx, 'description', e.target.value)}
                                    className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                    placeholder="Item description..."
                                  />
                                  {item.item_code && (
                                    <div className="text-[10px] text-slate-400 px-2 mt-0.5">
                                      Code: {item.item_code}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.material_name}
                                    onChange={(e) => handleRecordItemChange(idx, 'material_name', e.target.value)}
                                    className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                    placeholder="Material..."
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.material_type}
                                    onChange={(e) => handleRecordItemChange(idx, 'material_type', e.target.value)}
                                    className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-blue-500 rounded outline-none transition-all"
                                    placeholder="Type..."
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleRecordItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-center outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.unit_rate}
                                    onChange={(e) => handleRecordItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-center outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-slate-700">
                                  {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_rate) || 0))}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRecordRemoveItem(idx)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {recordData.items.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg flex justify-between items-center border border-blue-100">
                        <span className="text-sm  text-blue-700">Quotation Total</span>
                        <span className="text-xl  text-blue-900">{formatCurrency(recordData.amount)}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={recordData.notes}
                      onChange={(e) => setRecordData({...recordData, notes: e.target.value})}
                      placeholder="Add any notes from vendor response"
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                >
                  Create Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmailModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Send Quotation via Email</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSendEmail} className="">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({...emailData, to: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="attachPDF"
                  checked={emailData.attachPDF}
                  onChange={(e) => setEmailData({...emailData, attachPDF: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="attachPDF" className="text-sm text-slate-700">Attach Quotation PDF</label>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Send Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md text-slate-900 text-xs">Edit Quotation</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleEditQuotation} className="">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                  <select
                    value={editFormData.vendorId}
                    onChange={(e) => setEditFormData({...editFormData, vendorId: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.vendor_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={editFormData.validUntil}
                    onChange={(e) => setEditFormData({...editFormData, validUntil: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Line Items</label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData({
                        ...editFormData,
                        items: [...editFormData.items, { drawing_no: '', description: '', material_name: '', material_type: '', quantity: 0, uom: 'NOS', unit_rate: 0 }]
                      });
                    }}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700"
                  >
                    + Add Item
                  </button>
                </div>

                {editFormData.items.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center border border-dashed border-slate-200 rounded">
                    No items added yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-100 text-[10px]  text-slate-500  tracking-wider">
                      <div className="col-span-2">Drawing No</div>
                      <div className="col-span-3">Description</div>
                      <div className="col-span-3">Material Name</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-1">Qty</div>
                      <div className="col-span-1"></div>
                    </div>
                    {editFormData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Drawing No"
                          value={item.drawing_no}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].drawing_no = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].description = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-3 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Material Name"
                          value={item.material_name}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].material_name = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-3 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Type"
                          value={item.material_type}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].material_type = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-2 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].quantity = parseFloat(e.target.value) || 0;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="col-span-1 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = editFormData.items.filter((_, i) => i !== idx);
                              setEditFormData({...editFormData, items: newItems});
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                >
                  Update Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
