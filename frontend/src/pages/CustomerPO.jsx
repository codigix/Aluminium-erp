import React, { useState, useMemo } from 'react'
import {
  Loader2, ChevronRight, Eye, Plus, Trash2, X, Download, Pencil, Send,
  Search, RefreshCw, Filter, FileText, Calendar, Building2,
  DollarSign, Package, CheckCircle2, Clock, AlertCircle, GitBranch, Upload, MapPin
} from 'lucide-react'
import { Card, DataTable } from '../components/ui.jsx'
import SendEmailModal from '../components/SendEmailModal'
import { getFileUrl } from '../utils/url'

const poStatusColors = {
  DRAFT: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Clock },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  COMPLETED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: CheckCircle2 },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertCircle },
};

const CustomerPO = ({
  formatCurrency,
  customerPos = [],
  customerPosLoading,
  companies = [],
  apiRequest,
  showToast,
  onRefresh,
  quotationRequests = [],
  quotationRequestsLoading
}) => {
  const [showPoForm, setShowPoForm] = useState(false)
  const [formMode, setFormMode] = useState('CREATE') // CREATE, VIEW, EDIT
  const [editingPoId, setEditingPoId] = useState(null)
  const [hostCompanies, setHostCompanies] = useState([])
  const [selectedHostId, setSelectedHostId] = useState('')
  const [selectedHostCompany, setSelectedHostCompany] = useState(null)
  const [poFormLoading, setPoFormLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedQuoteId, setSelectedQuoteId] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailPoData, setEmailPoData] = useState(null)
  const [allDrawings, setAllDrawings] = useState([])
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedPoForModal, setSelectedPoForModal] = useState(null)

  const handleOpenPdf = (pdfPath) => {
    if (!pdfPath) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
    let cleanPath = pdfPath.replace(/\\/g, '/');
    if (!cleanPath.startsWith('http')) {
      if (!cleanPath.startsWith('uploads/') && !cleanPath.startsWith('/uploads/')) {
        cleanPath = `uploads/${cleanPath}`;
      }
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.slice(1);
      }
      cleanPath = `${baseUrl.replace(/\/api$/, '')}/${cleanPath}`;
    }
    window.open(cleanPath, '_blank');
  };

  const handleOpenUploadModal = (po) => {
    setSelectedPoForModal(po);
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setSelectedPoForModal(null);
  };

  const handleFileChangeInsideModal = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedPoForModal) return;

    setUploadLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
      const token = localStorage.getItem('authToken');

      const formData = new FormData();
      formData.append('poPdf', file);

      const response = await fetch(`${baseUrl}/customer-pos/${selectedPoForModal.id}/upload-pdf`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.error || 'Failed to upload document');
      }

      showToast('Customer PO document uploaded successfully');
      if (onRefresh) onRefresh();
    } catch (error) {
      showToast(error.message || 'Error uploading file');
    } finally {
      setUploadLoading(false);
    }
  };

  const [poForm, setPoForm] = useState({
    companyId: '',
    projectName: '',
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0],
    poVersion: '1.0',
    orderType: 'STANDARD',
    currency: 'INR',
    paymentTerms: '',
    creditDays: '',
    remarks: '',
    items: [
      {
        drawingNo: '',
        description: '',
        hsnCode: '',
        deliveryDate: '',
        quantity: '',
        unit: 'NOS',
        rate: '',
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: 0
      }
    ]
  })

  // Sync selected host company details when ID changes
  React.useEffect(() => {
    if (selectedHostId && hostCompanies.length > 0) {
      const matched = hostCompanies.find(h => String(h.id) === String(selectedHostId));
      setSelectedHostCompany(matched || null);
    }
  }, [selectedHostId, hostCompanies]);

  const fetchHostCompanies = async () => {
    try {
      const data = await apiRequest('/admin-company-master');
      if (data) {
        setHostCompanies(data);
        if (!selectedHostId) {
          const active = data.find(c => c.status === 'ACTIVE');
          if (active) {
            setSelectedHostId(String(active.id));
            setSelectedHostCompany(active);
          } else if (data.length > 0) {
            setSelectedHostId(String(data[0].id));
            setSelectedHostCompany(data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching host companies:', err);
    }
  };

  React.useEffect(() => {
    if (showPoForm) {
      fetchHostCompanies();
    }
  }, [showPoForm]);

  const handleActivateHostGlobally = async () => {
    if (!selectedHostCompany) return;
    if (window.confirm(`Do you want to make "${selectedHostCompany.company_name}" the active host company globally?`)) {
      try {
        await apiRequest(`/admin-company-master/${selectedHostCompany.id}`, {
          method: 'PUT',
          body: { status: 'ACTIVE' }
        });
        showToast('Billing profile activated globally');
        fetchHostCompanies();
      } catch (err) {
        showToast(err.message || 'Failed to activate profile');
      }
    }
  };

  // Fetch drawings for lookup when company changes
  React.useEffect(() => {
    const fetchAllDrawings = async () => {
      try {
        const data = await apiRequest('/drawings');
        if (data) setAllDrawings(data);
      } catch (error) {
        console.error('Error fetching drawings:', error);
      }
    };
    if (showPoForm) {
      fetchAllDrawings();
    }
  }, [showPoForm]);

  // Sync HSN and Delivery Date from drawing master
  React.useEffect(() => {
    if (allDrawings.length === 0 || poForm.items.length === 0) return;

    let changed = false;
    const updatedItems = poForm.items.map(item => {
      let itemChanged = false;
      const matchedDwg = allDrawings.find(d => 
        String(d.drawing_no).trim().toUpperCase() === String(item.drawingNo).trim().toUpperCase()
      );

      let newItem = { ...item };

      if (matchedDwg) {
        if (!item.hsnCode && matchedDwg.hsn_code) {
          newItem.hsnCode = matchedDwg.hsn_code;
          itemChanged = true;
        }
        if (!item.deliveryDate && matchedDwg.delivery_date) {
          newItem.deliveryDate = new Date(matchedDwg.delivery_date).toISOString().split('T')[0];
          itemChanged = true;
        }
      }

      // Sync sub-assemblies
      if (item.sub_assemblies && item.sub_assemblies.length > 0) {
        const updatedSAs = item.sub_assemblies.map(sa => {
          let saChanged = false;
          const matchedSaDwg = allDrawings.find(d => 
            String(d.drawing_no).trim().toUpperCase() === String(sa.drawingNo).trim().toUpperCase()
          );

          let newSA = { ...sa };
          if (matchedSaDwg) {
            if (!sa.hsnCode && matchedSaDwg.hsn_code) {
              newSA.hsnCode = matchedSaDwg.hsn_code;
              saChanged = true;
            }
            if (!sa.deliveryDate && matchedSaDwg.delivery_date) {
              newSA.deliveryDate = new Date(matchedSaDwg.delivery_date).toISOString().split('T')[0];
              saChanged = true;
            }
          }

          // Fallback: Inherit from parent if still empty
          if (!newSA.hsnCode && newItem.hsnCode) {
            newSA.hsnCode = newItem.hsnCode;
            saChanged = true;
          }
          if (!newSA.deliveryDate && newItem.deliveryDate) {
            newSA.deliveryDate = newItem.deliveryDate;
            saChanged = true;
          }

          if (saChanged) itemChanged = true;
          return saChanged ? newSA : sa;
        });
        if (itemChanged) newItem.sub_assemblies = updatedSAs;
      }

      if (itemChanged) changed = true;
      return itemChanged ? newItem : item;
    });

    if (changed) {
      setPoForm(prev => ({ ...prev, items: updatedItems }));
    }
  }, [allDrawings, poForm.items]); 

  // Auto-generate PO Number when form opens
  React.useEffect(() => {
    if (showPoForm && !poForm.poNumber) {
      const year = new Date().getFullYear();
      const count = (customerPos?.length || 0) + 1;
      const autoPo = `PO-${year}-${count.toString().padStart(3, '0')}`;
      setPoForm(prev => ({ ...prev, poNumber: autoPo }));
    }
  }, [showPoForm, customerPos]);

  // URL-based Modal Navigation
  React.useEffect(() => {
    // Initial check on mount
    if (window.location.pathname.includes('/sales/customer-po/new-po')) {
      setShowPoForm(true);
    }

    // Handle browser Back/Forward buttons
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/sales/customer-po') {
        setShowPoForm(false);
      } else if (path.includes('/sales/customer-po/new-po')) {
        setShowPoForm(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleQuotationSelect = async (quoteId) => {
    setSelectedQuoteId(quoteId);
    if (!quoteId) return;

    try {
      setPoFormLoading(true);
      // Fetch full details including sub-assemblies from the version history endpoint
      const versions = await apiRequest(`/quotation-requests/versions/${quoteId}`);
      
      // The version history endpoint returns an array of version groups. 
      // We need the specific version that matches our selected quoteId.
      let quote = null;
      for (const vGroup of versions) {
        const match = vGroup.items?.find(it => it.id === parseInt(quoteId));
        if (match) {
          quote = vGroup;
          break;
        }
      }

      if (!quote) {
        // Fallback to searching the main list if not found in history
        const basicQuote = quotationRequests.find(q => q.id === parseInt(quoteId));
        if (!basicQuote) {
          showToast('Quotation details not found');
          return;
        }
        quote = basicQuote;
      }

      // If we have a version group, it already contains the items.
      // If we have a basic quote, we might need to find its siblings if it's part of a batch.
      let relatedItems = [];
      if (quote.items) {
        relatedItems = quote.items;
      } else {
        relatedItems = quotationRequests.filter(q => {
          if (quote.batch_id && q.batch_id) {
            return q.batch_id === quote.batch_id;
          }
          return q.company_id === quote.company_id &&
            q.sales_order_id === quote.sales_order_id &&
            q.version === quote.version;
        });
      }

      const items = [];
      relatedItems
        .filter(item => (item.item_group || item.item_type || '').toUpperCase() !== 'SA')
        .forEach(item => {
        // Handle different property names between list view and version details
        const qty = parseFloat(item.item_qty || item.quantity) || 0;
        const totalAmount = parseFloat(item.total_amount || item.total) || 0;
        const unitRate = qty > 0 ? (totalAmount / qty) : totalAmount;
        const gst = item.gst_percentage || 18;

        const parentHsn = item.hsn_code || item.hsnCode || '';
        const parentDelivery = item.delivery_date || item.deliveryDate ? new Date(item.delivery_date || item.deliveryDate).toISOString().split('T')[0] : '';

        // Add the main FG item with its sub-assemblies nested
        items.push({
          drawingNo: (item.drawing_no || item.drawingNo || '') !== '—' ? (item.drawing_no || item.drawingNo || '').toUpperCase() : '',
          description: item.item_description || item.description,
          hsnCode: parentHsn,
          deliveryDate: parentDelivery,
          quantity: qty,
          unit: item.item_unit || item.unit || 'NOS',
          rate: unitRate.toFixed(2),
          cgstPercent: gst / 2,
          sgstPercent: gst / 2,
          igstPercent: 0,
          item_group: item.item_group,
          sub_assemblies: (() => {
            const seen = new Set();
            return (item.sub_assemblies || []).filter(sa => {
              const code = String(sa.component_code || sa.item_code || sa.drawing_no || sa.drawingNo || sa.description || '').trim().toLowerCase();
              if (seen.has(code)) return false;
              seen.add(code);
              return true;
            }).map(sa => ({
              ...sa,
              drawingNo: (sa.drawing_no || sa.component_code || sa.item_code || '').toUpperCase(),
              description: sa.description || `Sub-assembly`,
              hsnCode: sa.hsn_code || sa.hsnCode || parentHsn,
              deliveryDate: (sa.delivery_date || sa.deliveryDate) ? new Date(sa.delivery_date || sa.deliveryDate).toISOString().split('T')[0] : parentDelivery,
              quantity: parseFloat(sa.quantity || sa.qty || 0),
              unit: sa.uom || sa.unit || 'NOS',
              rate: parseFloat(sa.rate || sa.bom_cost || 0).toFixed(2),
              item_group: sa.item_group || 'SA'
            }));
          })()
        });
      });

      setPoForm(prev => ({
        ...prev,
        companyId: quote.company_id,
        projectName: quote.project_name || '',
        items: items.length > 0 ? items : prev.items
      }));

      showToast(`Loaded ${items.length} items from quotation QRT-${String(quoteId).padStart(4, '0')}`);
    } catch (error) {
      console.error('Error fetching quotation details:', error);
      showToast('Failed to fetch full quotation details');
    } finally {
      setPoFormLoading(false);
    }
  };

  const filteredPOs = useMemo(() => {
    return customerPos.filter(po => {
      const matchesSearch =
        po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.company_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customerPos, searchTerm, statusFilter]);

  const handleAddItem = () => {
    setPoForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          drawingNo: '',
          description: '',
          hsnCode: '',
          deliveryDate: '',
          quantity: '',
          unit: 'NOS',
          rate: '',
          cgstPercent: 0,
          sgstPercent: 0,
          igstPercent: 0
        }
      ]
    }))
  }

  const handleRemoveItem = (index) => {
    if (poForm.items.length === 1) return
    setPoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...poForm.items]
    newItems[index][field] = value
    setPoForm(prev => ({ ...prev, items: newItems }))
  }

  const closePoForm = () => {
    setShowPoForm(false)
    setFormMode('CREATE')
    setEditingPoId(null)
    if (window.location.pathname !== '/sales/customer-po') {
      window.history.pushState({}, '', '/sales/customer-po');
    }
    setSelectedQuoteId('')
    setSelectedHostId('')
    setSelectedHostCompany(null)
    setPoForm({
      companyId: '',
      projectName: '',
      poNumber: '',
      poDate: new Date().toISOString().split('T')[0],
      poVersion: '1.0',
      orderType: 'STANDARD',
      currency: 'INR',
      paymentTerms: '',
      creditDays: '',
      remarks: '',
      items: [
        {
          drawingNo: '',
          description: '',
          hsnCode: '',
          deliveryDate: '',
          quantity: '',
          unit: 'NOS',
          rate: '',
          cgstPercent: 0,
          sgstPercent: 0,
          igstPercent: 0
        }
      ]
    })
  }

  const openPoInMode = async (mode, poId = null) => {
    setFormMode(mode);
    if (poId) {
      setEditingPoId(poId);
      setPoFormLoading(true);
      setShowPoForm(true);
      try {
        const data = await apiRequest(`/customer-pos/${poId}`);
        if (data.host_company_id) {
          setSelectedHostId(String(data.host_company_id));
        } else {
          const active = hostCompanies.find(c => c.status === 'ACTIVE');
          if (active) {
            setSelectedHostId(String(active.id));
            setSelectedHostCompany(active);
          } else if (hostCompanies.length > 0) {
            setSelectedHostId(String(hostCompanies[0].id));
            setSelectedHostCompany(hostCompanies[0]);
          }
        }
        // Map data to poForm structure
        setPoForm({
          companyId: data.company_id,
          projectName: data.project_name || '',
          poNumber: data.po_number,
          poDate: data.po_date ? new Date(data.po_date).toISOString().split('T')[0] : '',
          poVersion: data.po_version || '1.0',
          orderType: data.order_type || 'STANDARD',
          currency: data.currency || 'INR',
          paymentTerms: data.payment_terms || '',
          creditDays: data.credit_days || '',
          remarks: data.remarks || '',
          items: data.items.map(item => ({
            drawingNo: item.drawing_no || '',
            description: item.description || '',
            hsnCode: item.hsn_code || '',
            deliveryDate: item.delivery_date ? new Date(item.delivery_date).toISOString().split('T')[0] : '',
            quantity: item.quantity || '',
            unit: item.unit || 'NOS',
            rate: item.rate || '',
            cgstPercent: item.cgst_percent || 0,
            sgstPercent: item.sgst_percent || 0,
            igstPercent: item.igst_percent || 0,
            sub_assemblies: (() => {
              const seen = new Set();
              return (item.sub_assemblies || []).filter(sa => {
                const code = String(sa.component_code || sa.item_code || sa.drawing_no || sa.drawingNo || sa.description || '').trim().toLowerCase();
                if (seen.has(code)) return false;
                seen.add(code);
                return true;
              }).map(sa => ({
                ...sa,
                drawingNo: (sa.drawing_no || sa.component_code || sa.item_code || '').toUpperCase(),
                description: sa.description || `Sub-assembly`,
                hsnCode: sa.hsn_code || '',
                deliveryDate: sa.delivery_date ? new Date(sa.delivery_date).toISOString().split('T')[0] : '',
                quantity: parseFloat(sa.quantity || sa.qty || 0),
                unit: sa.uom || sa.unit || 'NOS',
                rate: parseFloat(sa.rate || sa.bom_cost || 0).toFixed(2),
                item_group: sa.item_group || 'SA'
              }));
            })()
          }))
        });
      } catch (error) {
        showToast(error.message || 'Failed to fetch PO details');
        closePoForm();
      } finally {
        setPoFormLoading(false);
      }
    } else {
      setShowPoForm(true);
      if (window.location.pathname !== '/sales/customer-po/new-po') {
        window.history.pushState({}, '', '/sales/customer-po/new-po');
      }
    }
  };

  const handlePoSubmit = async (e) => {
    e.preventDefault()
    if (!poForm.companyId) {
      showToast('Please select a company')
      return
    }

    setPoFormLoading(true)
    try {
      const payload = {
        companyId: poForm.companyId,
        projectName: poForm.projectName,
        poNumber: poForm.poNumber,
        poDate: poForm.poDate,
        poVersion: poForm.poVersion,
        orderType: poForm.orderType,
        currency: poForm.currency,
        paymentTerms: poForm.paymentTerms,
        creditDays: poForm.creditDays,
        items: poForm.items.map(item => ({
          ...item,
          drawingNo: (item.drawingNo || '').toUpperCase(),
          hsn_code: item.hsnCode,
          delivery_date: item.deliveryDate,
          sub_assemblies: (item.sub_assemblies || []).map(sa => ({
            drawingNo: (sa.drawingNo || '').toUpperCase(),
            description: sa.description,
            hsn_code: sa.hsnCode,
            delivery_date: sa.deliveryDate,
            quantity: sa.quantity,
            unit: sa.unit,
            rate: sa.rate
          }))
        })),
        remarks: poForm.remarks,
        hostCompanyId: selectedHostId || null
      }

      const url = formMode === 'EDIT' ? `/customer-pos/${editingPoId}` : '/customer-pos';
      const method = formMode === 'EDIT' ? 'PUT' : 'POST';

      await apiRequest(url, {
        method: method,
        body: payload
      })
      showToast(`Customer PO ${formMode === 'EDIT' ? 'updated' : 'created'} successfully`)
      closePoForm()
      if (onRefresh) onRefresh()
    } catch (error) {
      showToast(error.message)
    } finally {
      setPoFormLoading(false)
    }
  }

  const handleDownloadPdf = async (poId, poNumber) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
      const token = localStorage.getItem('authToken');

      const response = await fetch(`${baseUrl}/customer-pos/${poId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      showToast(error.message);
    }
  };

  const handleDeletePo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Customer PO? This action cannot be undone.')) {
      return;
    }

    try {
      await apiRequest(`/customer-pos/${id}`, {
        method: 'DELETE'
      });
      showToast('Customer PO deleted successfully');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete PO error:', error);
      showToast(error.message || 'Failed to delete Customer PO');
    }
  };

  const handleOpenEmailModal = (row) => {
    const company = companies.find(c => String(c.id) === String(row.company_id));
    const clientName = row.company_name || company?.company_name || 'Client';
    
    // Fallback chain for email address
    const primaryContact = company?.contacts?.find(c => c.contact_type === 'PRIMARY') || company?.contacts?.[0];
    const recipientEmail = row.company_email || primaryContact?.email || company?.email || '';

    setEmailPoData({
      id: row.id,
      to: recipientEmail,
      subject: `Purchase Order: ${row.po_number}`,
      message: `Dear ${clientName},\n\nPlease find attached our Purchase Order ${row.po_number}.\n\nRegards,\nSPTECHPIONEER Procurement Team`,
      attachmentName: `PurchaseOrder_${row.po_number}.pdf`,
      poNumber: row.po_number
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async (emailData) => {
    try {
      await apiRequest(`/customer-pos/${emailPoData.id}/send-email`, {
        method: 'POST',
        body: emailData
      });
      showToast('Email sent successfully');
      setShowEmailModal(false);
    } catch (error) {
      showToast(error.message || 'Failed to send email');
      throw error;
    }
  };

  const columns = [
    {
      label: 'PO Details',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-xs  text-slate-900   ">{row.po_number}</p>
        </div>
      )
    },
    {
      label: 'Client & Project',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-xs  text-slate-900">{row.company_name}</span>
          <span className="text-[11px] text-slate-500 italic">
            {row.project_name || 'General Project'}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
            <Calendar className="w-3 h-3" />
            <span className="text-xs ">
              {new Date(row.po_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      )
    },
    {
      label: 'Amount',
      render: (_, row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-emerald-600 ">
            <span className="text-xs ">{formatCurrency(row.net_total)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400  ">
            <span>Incl. Taxes</span>
          </div>
        </div>
      )
    },
    {
      label: 'Action',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          {row.pdf_path ? (
            <button
              onClick={() => handleOpenUploadModal(row)}
              className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center gap-1.5"
              title="View or Manage PO Documents"
            >
              <Eye className="w-3.5 h-3.5" />
              View/Manage PO
            </button>
          ) : (
            <button
              onClick={() => handleOpenUploadModal(row)}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded text-xs hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Upload PO document"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PO
            </button>
          )}
          <button
            onClick={() => openPoInMode('VIEW', row.id)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded  transition-all border border-transparent hover:border-indigo-100"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDownloadPdf(row.id, row.po_number)}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all border border-transparent hover:border-emerald-100"
            title="Download/View PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => openPoInMode('EDIT', row.id)}
            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded  transition-all border border-transparent hover:border-amber-100"
            title="Edit PO"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenEmailModal(row)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded  transition-all border border-transparent hover:border-blue-100"
            title="Send Email"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeletePo(row.id)}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all border border-transparent hover:border-rose-100"
            title="Delete PO"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl  text-slate-900  flex items-center gap-2">
            Customer Purchase Orders
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-md   ">Enterprise</span>
          </h1>
          <p className="text-slate-500 text-xs ">Manage and track external purchase orders from your clients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefresh && onRefresh()}
            className="p-2 text-slate-500 hover:bg-white hover:text-indigo-600 rounded  transition-all border border-slate-200 bg-slate-50/50  active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => openPoInMode('CREATE')}
            className="flex items-center gap-2 bg-indigo-600 text-white p-2  rounded text-xs  hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Purchase Order
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 my-4 md:grid-cols-4 gap-2">
        {[
          { label: 'Total Orders', value: customerPos.length, color: 'indigo', icon: FileText },
          { label: 'Pending Approval', value: customerPos.filter(p => p.status === 'PENDING').length, color: 'amber', icon: Clock },
          { label: 'Completed', value: customerPos.filter(p => p.status === 'COMPLETED').length, color: 'emerald', icon: CheckCircle2 },
          { label: 'Total Value', value: formatCurrency(customerPos.reduce((sum, p) => sum + (parseFloat(p.net_total) || 0), 0)), color: 'blue', icon: DollarSign },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200 rounded p-2  hover: transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs  text-slate-400  ">{stat.label}</p>
                  <p className="text-xl  text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 bg-${stat.color}-50 text-${stat.color}-600 rounded `}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row mb-3 items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or client name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 p-2 bg-white border border-slate-200 rounded text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all  "
          />
        </div>
        <div className="flex items-center gap-2 p-2  bg-white border border-slate-200 rounded  w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400   ">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs  text-indigo-600 outline-none bg-transparent cursor-pointer min-w-[100px]"
          >
            <option value="ALL">All Orders</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded border border-slate-200  overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredPOs}
          loading={customerPosLoading}
          hideHeader={true}
          className="border-none shadow-none rounded-none"
        />
        {filteredPOs.length === 0 && !customerPosLoading && (
          <div className="py-20 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-900  text-lg">No orders found</h3>
            <p className="text-slate-500 text-xs  ">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* Manage PO Documents Modal */}
      {showUploadModal && selectedPoForModal && (() => {
        const activePo = customerPos.find(p => p.id === selectedPoForModal.id) || selectedPoForModal;
        const files = activePo.pdf_path ? activePo.pdf_path.split(',').map(f => f.trim()).filter(Boolean) : [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleCloseUploadModal} />
            <div className="relative w-full max-w-md bg-white shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-100">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Manage PO Documents</h3>
                  <p className="text-[11px] text-indigo-600 font-medium mt-0.5">{activePo.po_number || 'No PO#'}</p>
                </div>
                <button
                  onClick={handleCloseUploadModal}
                  className="p-1.5 rounded-full hover:bg-slate-200/70 transition-all text-slate-400 hover:text-slate-700 bg-slate-100 animate-none"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">
                {/* Existing files list */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Uploaded Files ({files.length})</h4>
                  {files.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                      <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500">No documents uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {files.map((file, idx) => {
                        const rawName = file.split('/').pop() || file.split('\\').pop() || '';
                        const parts = rawName.split('-');
                        const fileName = parts.length > 1 ? parts.slice(1).join('-') : rawName;
                        
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg hover:bg-slate-100/70 transition-all">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span className="text-xs text-slate-700 truncate font-medium" title={fileName}>{fileName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(file)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-2.5 py-1 rounded transition-all hover:border-indigo-100 shadow-sm shrink-0 active:scale-95"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Upload Form */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Attach New Document</h4>
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-indigo-300 transition-all cursor-pointer bg-slate-50/50 group relative">
                    <input
                      type="file"
                      onChange={handleFileChangeInsideModal}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={uploadLoading}
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      {uploadLoading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                          <p className="text-xs font-semibold text-slate-600">Uploading document...</p>
                        </>
                      ) : (
                        <>
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-all">
                            <Upload className="w-5.5 h-5.5" />
                          </div>
                          <p className="text-xs font-semibold text-slate-700">Click to upload file</p>
                          <p className="text-[10px] text-slate-400">PDF, PNG, JPG, JPEG up to 10MB</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manual PO Form Modal */}
      {showPoForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={closePoForm} />
          <div className="relative w-full max-w-5xl bg-white shadow-2xl rounded  flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
            {/* Modal Header */}
            <div className="p-2  border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div>
                <h2 className="text-xl  text-slate-900 ">
                  {formMode === 'VIEW' ? 'View Details' : formMode === 'EDIT' ? 'Update' : 'New'} Customer Purchase Order
                </h2>
                <p className="text-xs text-slate-500    mt-1">
                  {formMode === 'VIEW' ? 'Reference only' : 'Manual Data Entry Workflow'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formMode === 'VIEW' && (
                  <button
                    onClick={() => setFormMode('EDIT')}
                    className="p-2 rounded hover:bg-amber-100 transition-all text-amber-600 active:scale-90 bg-amber-50 border border-amber-100 flex items-center gap-2 text-xs "
                    title="Switch to Edit Mode"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                )}
                <button
                  onClick={closePoForm}
                  className="p-2 rounded hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-900 active:scale-90 bg-slate-50 border border-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              <form onSubmit={handlePoSubmit} id="po-manual-form" className="space-y-10">
                {/* Host Company Profile Details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded ">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm text-slate-800">Host Billing Entity Details</h3>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-100 pb-3">
                      <div className="w-full md:max-w-md space-y-2">
                        <label className="text-xs text-slate-400 ml-1">Select Issuing Billing Profile *</label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700 appearance-none font-medium"
                          value={selectedHostId}
                          onChange={(e) => {
                            const host = hostCompanies.find(h => String(h.id) === String(e.target.value));
                            setSelectedHostId(e.target.value);
                            setSelectedHostCompany(host || null);
                          }}
                          disabled={formMode === 'VIEW'}
                        >
                          <option value="">Select billing profile...</option>
                          {hostCompanies.map(h => (
                            <option key={h.id} value={h.id}>
                              {h.company_name} {h.status === 'ACTIVE' ? '(ACTIVE)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedHostCompany && selectedHostCompany.status !== 'ACTIVE' && formMode !== 'VIEW' && (
                        <button
                          type="button"
                          className="border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded text-xs transition-all font-medium"
                          onClick={handleActivateHostGlobally}
                        >
                          Activate Globally
                        </button>
                      )}
                    </div>

                    {selectedHostCompany ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
                        <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                          {selectedHostCompany.company_logo ? (
                            <img
                              src={getFileUrl(selectedHostCompany.company_logo)}
                              alt="Logo"
                              className="h-16 max-w-full object-contain mb-2 bg-white border border-slate-200 p-1.5 rounded shadow-sm"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-lg mb-2">
                              {selectedHostCompany.company_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-bold text-slate-800 leading-tight truncate w-full">{selectedHostCompany.company_name}</span>
                          <span className={`text-[9px] mt-1.5 px-2 py-0.5 rounded-full font-semibold border ${
                            selectedHostCompany.status === 'ACTIVE'
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}>
                            {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                          </span>
                        </div>

                        <div className="space-y-2 p-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Office Details</p>
                          <div className="space-y-1 text-slate-600 text-xs">
                            <div className="flex gap-1.5 items-start">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed whitespace-pre-line">{selectedHostCompany.company_address || '—'}</span>
                            </div>
                            <div className="pt-1 flex flex-col gap-1">
                              <p className="font-mono text-[10px]">GSTIN: <span className="font-bold text-slate-700">{selectedHostCompany.gstin || '—'}</span></p>
                              <p className="font-mono text-[10px]">PAN: <span className="font-bold text-slate-700">{selectedHostCompany.pan || '—'}</span></p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 p-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Credentials</p>
                          <div className="space-y-1.5 text-slate-600 text-xs font-mono">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-sans">Bank Name</p>
                              <p className="font-bold text-slate-700 font-sans text-xs truncate">{selectedHostCompany.bank_name || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-sans">Account & IFSC</p>
                              <p className="font-semibold text-slate-800 text-xs">{selectedHostCompany.account_number || '—'}</p>
                              {selectedHostCompany.ifsc_code && (
                                <p className="text-[10px] text-slate-400">IFSC: {selectedHostCompany.ifsc_code.toUpperCase()}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                        Select a host company profile above to preview its billing and banking credentials
                      </div>
                    )}
                  </div>
                </div>

                {/* Header Information Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm  text-slate-800  ">General Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {formMode === 'CREATE' && (
                      <div className="space-y-2">
                        <label className="text-xs  text-slate-400   ml-1">Quotation No (Fetch Details)</label>
                        <select
                          value={selectedQuoteId}
                          onChange={(e) => handleQuotationSelect(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700 appearance-none"
                        >
                          <option value="">Manual Entry (No Quotation)</option>
                          {(() => {
                            const batches = [];
                            const processedIds = new Set();
                            const approvedItems = quotationRequests.filter(q => q.status?.trim().toUpperCase() === 'APPROVED');

                            approvedItems.forEach(q => {
                              if (processedIds.has(q.id)) return;
                              const batchItems = approvedItems.filter(t =>
                                t.company_id === q.company_id &&
                                t.sales_order_id === q.sales_order_id &&
                                t.version === q.version
                              );
                              const representative = batchItems.reduce((min, cur) => cur.id < min.id ? cur : min, batchItems[0]);
                              const isAlreadyAdded = batches.some(b =>
                                b.sales_order_id === representative.sales_order_id &&
                                b.version === representative.version
                              );
                              if (!isAlreadyAdded) {
                                batches.push(representative);
                              }
                              batchItems.forEach(item => processedIds.add(item.id));
                            });

                            return batches.map(q => (
                              <option key={q.id} value={q.id}>
                                QRT-{String(q.id).padStart(4, '0')} - {q.company_name} ({q.project_name || 'No Project'}) {q.version > 1 ? `(V${q.version})` : ''}
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Project Name</label>
                      <input
                        type="text"
                        disabled={formMode === 'VIEW'}
                        value={poForm.projectName}
                        onChange={(e) => setPoForm(prev => ({ ...prev, projectName: e.target.value }))}
                        placeholder="Project name..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Company / Client *</label>
                      <select
                        required
                        disabled={formMode === 'VIEW'}
                        value={poForm.companyId}
                        onChange={(e) => setPoForm(prev => ({ ...prev, companyId: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700 appearance-none"
                      >
                        <option value="">Select Company</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.company_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">PO Number *</label>
                      <input
                        required
                        type="text"
                        disabled={formMode === 'VIEW'}
                        value={poForm.poNumber}
                        onChange={(e) => setPoForm(prev => ({ ...prev, poNumber: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-900 "
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">PO Date *</label>
                      <input
                        required
                        type="date"
                        disabled={formMode === 'VIEW'}
                        value={poForm.poDate}
                        onChange={(e) => setPoForm(prev => ({ ...prev, poDate: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Order Type</label>
                      <select
                        disabled={formMode === 'VIEW'}
                        value={poForm.orderType}
                        onChange={(e) => setPoForm(prev => ({ ...prev, orderType: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="URGENT">Urgent</option>
                        <option value="SERVICE">Service</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Currency</label>
                      <input
                        type="text"
                        disabled={formMode === 'VIEW'}
                        value={poForm.currency}
                        onChange={(e) => setPoForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Table Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
                        <Package className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm  text-slate-800  ">Purchase Items</h3>
                    </div>
                    {formMode !== 'VIEW' && (
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-2 p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded  text-xs    hover:bg-indigo-100 transition-all active:scale-95 "
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        Add Line Item
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded border-2 border-slate-100 bg-white ">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-100">
                          <th className="p-2  text-xs  text-slate-400   text-left w-32">Drawing No *</th>
                          <th className="p-2  text-xs  text-slate-400   text-left">Description *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-24">HSN Code</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-32">Item Delivery</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">Qty *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-16">Unit</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-24">Rate *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-12">CGST%</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-12">SGST%</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-12">IGST%</th>
                          <th className="p-2  text-xs  text-slate-400   text-right pr-6 w-28">Total</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {poForm.items.flatMap((item, index) => {
                          const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                          const tax = subtotal * ((parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0) + (parseFloat(item.igstPercent) || 0)) / 100;
                          const total = subtotal + tax;
                          const rows = [];
                          rows.push(
                            <tr key={`item-${index}`} className="group hover:bg-indigo-50/30 transition-all">
                              <td className="p-2">
                                <input
                                  required
                                  type="text"
                                  disabled={formMode === 'VIEW'}
                                  value={item.drawingNo?.toUpperCase() || ''}
                                  onChange={(e) => handleItemChange(index, 'drawingNo', e.target.value.toUpperCase())}
                                  placeholder="DRW-101"
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  required
                                  type="text"
                                  disabled={formMode === 'VIEW'}
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  placeholder="Item description..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  disabled={formMode === 'VIEW'}
                                  value={item.hsnCode || ''}
                                  onChange={(e) => handleItemChange(index, 'hsnCode', e.target.value)}
                                  placeholder="HSN..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  disabled={formMode === 'VIEW'}
                                  value={item.deliveryDate || ''}
                                  onChange={(e) => handleItemChange(index, 'deliveryDate', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  required
                                  type="number"
                                  disabled={formMode === 'VIEW'}
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  required
                                  type="text"
                                  disabled={formMode === 'VIEW'}
                                  value={item.unit}
                                  onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600 "
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  required
                                  type="number"
                                  disabled={formMode === 'VIEW'}
                                  value={item.rate}
                                  onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                  className="w-full bg-indigo-50 border border-indigo-100 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-indigo-600 placeholder:text-indigo-200"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  disabled={formMode === 'VIEW'}
                                  value={item.cgstPercent}
                                  onChange={(e) => handleItemChange(index, 'cgstPercent', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  disabled={formMode === 'VIEW'}
                                  value={item.sgstPercent}
                                  onChange={(e) => handleItemChange(index, 'sgstPercent', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  disabled={formMode === 'VIEW'}
                                  value={item.igstPercent}
                                  onChange={(e) => handleItemChange(index, 'igstPercent', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                />
                              </td>
                              <td className="p-2 text-right pr-6">
                                <span className="text-xs   text-slate-900">{formatCurrency(total)}</span>
                              </td>
                              <td className="p-2 text-center">
                                {formMode !== 'VIEW' && poForm.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    className="p-2 bg-slate-50 border border-slate-200 rounded  text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all active:scale-90"
                                    title="Remove Item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );

                          if (item.sub_assemblies && item.sub_assemblies.length > 0) {
                            item.sub_assemblies.forEach((sa, saIdx) => {
                              const saQty = (parseFloat(sa.quantity || 0) * (parseFloat(item.quantity) || 0));
                              const saRate = parseFloat(sa.rate || 0);
                              const saTotal = saQty * saRate;
                              rows.push(
                                <tr key={`item-${index}-sa-${saIdx}`} className="bg-slate-50/40">
                                  <td className="p-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2 pl-3">
                                      <GitBranch size={12} className="text-blue-400 rotate-180" />
                                      <span className="text-[9px] text-slate-500 font-mono ">{(sa.drawingNo || '').toUpperCase()}</span>
                                    </div>
                                  </td>
                                  <td className="p-2 border-b border-slate-100">
                                    <div className="flex flex-col pl-3">
                                      <span className="text-[11px] text-slate-700 font-semibold">{sa.description}</span>
                                      {(() => {
                                        const saGroup = (sa.item_group || '').toUpperCase();
                                        const isSaPart = saGroup.includes('PART');
                                        const displaySaGroup = 'PART';
                                        return (
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`px-1 py-0.5 rounded-[3px] text-[8px] ${isSaPart
                                              ? 'bg-blue-50 text-blue-600 border border-blue-100/50'
                                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                                              }`}>
                                              {displaySaGroup}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="p-2 border-b border-slate-100 text-center text-[10px] text-slate-500 ">
                                    {sa.hsnCode || '—'}
                                  </td>
                                  <td className="p-2 border-b border-slate-100 text-center text-[10px] text-slate-500 ">
                                    {sa.deliveryDate ? new Date(sa.deliveryDate).toLocaleDateString('en-GB') : '—'}
                                  </td>
                                  <td className="p-2 border-b border-slate-100 text-center text-[11px] text-slate-600 ">
                                    {saQty.toFixed(3)}
                                  </td>
                                  <td className="p-2 border-b border-slate-100 text-center text-[11px] text-slate-400 ">
                                    {sa.unit || 'Nos'}
                                  </td>
                                  <td className="p-2 border-b border-slate-100 text-center text-[11px] text-slate-700 ">
                                    {formatCurrency(saRate)}
                                  </td>
                                  <td colSpan="3" className="p-2 border-b border-slate-100"></td>
                                  <td className="p-2 border-b border-slate-100 text-right pr-6 text-[11px] text-slate-900 ">
                                    {formatCurrency(saTotal)}
                                  </td>
                                  <td className="p-2 border-b border-slate-100"></td>
                                </tr>
                              );
                            });
                          }
                          return rows;
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50/50">
                        <tr>
                          <td colSpan="8" className="px-4 p-2 text-right text-xs  text-slate-400  ">Grand Total (Incl. Taxes)</td>
                          <td className="px-4 p-2 text-right pr-6">
                            <span className="text-sm  text-indigo-600">
                              {formatCurrency(poForm.items.reduce((sum, item) => {
                                const sub = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                                const tax = sub * ((parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0) + (parseFloat(item.igstPercent) || 0)) / 100;
                                return sum + sub + tax;
                              }, 0))}
                            </span>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-slate-50 text-slate-600 rounded ">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm  text-slate-800  ">Additional Notes</h3>
                  </div>
                  <textarea
                    value={poForm.remarks}
                    disabled={formMode === 'VIEW'}
                    onChange={(e) => setPoForm(prev => ({ ...prev, remarks: e.target.value }))}
                    rows="4"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded  p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700 "
                    placeholder="Enter any additional remarks, special instructions, or terms..."
                  />
                </div>
              </form>
            </div>

            <div className="p-2  border-t border-slate-100 bg-slate-50/80 backdrop-blur-md flex items-center justify-between sticky bottom-0 z-10">
              <div className="hidden md:block">
                <p className="text-xs  text-slate-400  ">Mandatory Fields *</p>
                <p className="text-xs  text-slate-500  mt-1">Check all line items before submitting</p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={closePoForm}
                  className="flex-1 md:flex-none p-2  rounded text-xs    text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95"
                >
                  {formMode === 'VIEW' ? 'Close' : 'Cancel'}
                </button>
                {formMode !== 'VIEW' && (
                  <button
                    form="po-manual-form"
                    type="submit"
                    disabled={poFormLoading}
                    className="flex-1 md:flex-none bg-indigo-600 text-white p-2  rounded text-xs    hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                  >
                    {poFormLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin stroke-[3]" />
                        Processing...
                      </>
                    ) : (
                      formMode === 'EDIT' ? 'Update Purchase Order' : 'Confirm & Create PO'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && emailPoData && (
        <SendEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          data={emailPoData}
          onSend={handleSendEmail}
          title="Send PO to Client"
          subTitle={`${emailPoData.poNumber}`}
          attachmentName={emailPoData.attachmentName}
        />
      )}
    </div>
  )
}

export default CustomerPO
