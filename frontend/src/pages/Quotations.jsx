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
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [formData, setFormData] = useState({
    vendorId: '',
    salesOrderId: '',
    validUntil: '',
    notes: '',
    items: [{ item_code: '', description: '', quantity: 0, unit: 'NOS', unit_rate: 0 }]
  });
  const [recordData, setRecordData] = useState({
    quotationId: '',
    amount: 0,
    validUntil: ''
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
      items: [...formData.items, { item_code: '', description: '', quantity: 0, unit: 'NOS', unit_rate: 0 }]
    });
  };

  const handleSalesOrderChange = async (e) => {
    const soId = e.target.value;
    setFormData({ ...formData, salesOrderId: soId });

    if (!soId) {
      setFormData(prev => ({
        ...prev,
        items: [{ item_code: '', description: '', quantity: 0, unit: 'NOS', unit_rate: 0 }]
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
        const formattedItems = items.map(item => ({
          item_code: item.item_code || '',
          description: item.description || '',
          quantity: item.quantity || 0,
          unit: item.unit || 'NOS',
          unit_rate: item.rate || 0
        }));

        setFormData(prev => ({
          ...prev,
          items: formattedItems.length > 0 ? formattedItems : [{ item_code: '', description: '', quantity: 0, unit: 'NOS', unit_rate: 0 }]
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
        items: [{ item_code: '', description: '', quantity: 0, unit: 'NOS', unit_rate: 0 }]
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
      Swal.fire('Error', 'Select a quotation', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/${recordData.quotationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validUntil: recordData.validUntil,
          items: [{ quantity: 1, unit_rate: recordData.amount, description: 'Quoted Amount' }]
        })
      });

      if (!response.ok) throw new Error('Failed to record quote');

      await fetch(`${API_BASE}/quotations/${recordData.quotationId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'RECEIVED' })
      });

      await Swal.fire('Success', 'Quote recorded successfully', 'success');
      setShowRecordModal(false);
      setRecordData({ quotationId: '', amount: 0, validUntil: '' });
      fetchQuotations();
      fetchStats();
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to record quote', 'error');
    }
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

      if (!response.ok) throw new Error('Failed to delete quotation');

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
    setEditFormData({
      vendorId: quotation.vendor_id,
      validUntil: quotation.valid_until || '',
      items: quotation.items || [{ item_code: '', description: '', quantity: 0, unit: 'NOS', unit_rate: 0 }]
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
      ? ['SENT', 'DRAFT', 'CLOSED'].includes(q.status)
      : ['RECEIVED', 'REVIEWED', 'PENDING'].includes(q.status);

    const matchesSearch = q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All Quotations' || q.status === filterStatus;

    return isTabMatch && matchesSearch && matchesStatus;
  });

  const getVendorName = (vendorId) => {
    return vendors.find(v => v.id === vendorId)?.vendor_name || 'Unknown Vendor';
  };

  const getSalesOrderRef = (soId) => {
    return salesOrders.find(s => s.id === soId)?.project_name || '';
  };

  return (
    <div className="space-y-6">
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              📋 {activeTab === 'sent' ? 'Request Quote' : 'Record Quote'}
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              ⬇ Export Report
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 px-1 text-sm font-semibold transition ${
              activeTab === 'sent'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sent Requests (RFQ)
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`pb-3 px-1 text-sm font-semibold transition ${
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
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.2em] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Quote No.</th>
                  <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-4 py-3 text-left font-semibold">{activeTab === 'sent' ? 'Valid Till' : 'Total Amount'}</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
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
                        <div className="font-semibold">{formatCurrency(q.total_amount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${rfqStatusColors[q.status]?.badge}`}>
                        {rfqStatusColors[q.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      {activeTab === 'sent' && (
                        <>
                          <button
                            onClick={() => openEmailModal(q)}
                            className="px-3 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium transition"
                            title={q.status === 'SENT' ? 'Resend RFQ to vendor' : 'Send RFQ to vendor via email'}
                          >
                            📧 {q.status === 'SENT' ? 'Resend' : 'Send'}
                          </button>
                          <button
                            onClick={() => openEditModal(q)}
                            className="px-3 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition"
                            title="Edit quotation details"
                          >
                            ✎ Edit
                          </button>
                        </>
                      )}
                      {activeTab === 'received' && q.status === 'RECEIVED' && (
                        <button
                          onClick={() => handleApproveQuote(q.id)}
                          className="px-3 py-1 text-xs rounded border border-green-200 text-green-600 hover:bg-green-50 font-medium"
                          title="Approve and enable PO creation"
                        >
                          ✓ Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteQuotation(q.id)}
                        className="px-3 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium"
                      >
                        🗑
                      </button>
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
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">Total Quotations</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total_quotations || 0}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-1">Pending Quotes</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pending_quotations || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Approved Quotes</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.approved_quotations || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">Total Value</p>
            <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.total_value)}</p>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {activeTab === 'sent' ? 'Create Quote Request (RFQ)' : 'Record Received Quote'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={activeTab === 'sent' ? handleCreateQuotation : handleRecordQuote} className="space-y-4">
              {activeTab === 'sent' ? (
                <>
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

                  <div>
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
                      <p className="text-sm text-slate-500 p-4 text-center border border-dashed border-slate-200 rounded">
                        No items added yet. Click "Add Item" to include line items in this quotation.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {formData.items.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-6 gap-2">
                            <input
                              type="text"
                              placeholder="Item Code"
                              value={item.item_code}
                              onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              className="col-span-2 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              placeholder="Rate"
                              value={item.unit_rate}
                              onChange={(e) => handleItemChange(idx, 'unit_rate', parseFloat(e.target.value) || 0)}
                              className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 text-xs font-medium rounded border border-red-200"
                            >
                              ✕
                            </button>
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Quote to Record</label>
                    <select
                      value={recordData.quotationId}
                      onChange={(e) => setRecordData({...recordData, quotationId: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Select a Quotation --</option>
                      {quotations.filter(q => ['SENT', 'DRAFT'].includes(q.status)).map(q => (
                        <option key={q.id} value={q.id}>{q.quote_number} - {getVendorName(q.vendor_id)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quoted Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={recordData.amount}
                      onChange={(e) => setRecordData({...recordData, amount: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                  {activeTab === 'sent' ? 'Create Quotation' : 'Record Quote'}
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
              <h3 className="text-lg font-semibold text-slate-900">Send Quotation via Email</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Edit Quotation</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleEditQuotation} className="space-y-4">
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

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700">Line Items</label>
                </div>

                {editFormData.items.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4 text-center border border-dashed border-slate-200 rounded">
                    No items
                  </p>
                ) : (
                  <div className="space-y-3">
                    {editFormData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-6 gap-2">
                        <input
                          type="text"
                          placeholder="Item Code"
                          value={item.item_code}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].item_code = e.target.value;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          className="col-span-2 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.unit_rate}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].unit_rate = parseFloat(e.target.value) || 0;
                            setEditFormData({...editFormData, items: newItems});
                          }}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
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
