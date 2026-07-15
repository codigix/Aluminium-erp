import React, { useState, useMemo } from 'react'
import {
  Loader2, ChevronRight, Eye, Plus, Trash2, X, Download, Pencil, Send,
  Search, RefreshCw, Filter, FileText, Calendar, Building2,
  DollarSign, Package, CheckCircle2, Clock, AlertCircle, GitBranch, Upload, MapPin, User
} from 'lucide-react'
import { Card, DataTable, SearchableSelect } from '../components/ui.jsx'
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
  const [selectedQuoteContact, setSelectedQuoteContact] = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailPoData, setEmailPoData] = useState(null)
  const [allDrawings, setAllDrawings] = useState([])
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedPoForModal, setSelectedPoForModal] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [existingAttachments, setExistingAttachments] = useState([])
  const [localError, setLocalError] = useState('')
  const [quotationDrawings, setQuotationDrawings] = useState([])
  const [selectedDrawingVal, setSelectedDrawingVal] = useState('')

  const allQuotationDrawings = useMemo(() => {
    const approvedBatches = new Set();
    quotationRequests.forEach(q => {
      if ((q.status || '').trim().toUpperCase() === 'APPROVED' && q.batch_id) {
        approvedBatches.add(`${q.batch_id}|${q.version}`);
      }
    });

    return quotationRequests.filter(q => {
      const isComponent = (q.status || '').trim().toUpperCase() === 'COMPONENT';
      if (isComponent || !q.drawing_no) return false;

      const isApproved = (q.status || '').trim().toUpperCase() === 'APPROVED';
      const key = `${q.batch_id}|${q.version}`;
      const isBelongingToApprovedBatch = q.batch_id && approvedBatches.has(key);

      return isApproved || isBelongingToApprovedBatch;
    });
  }, [quotationRequests]);



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
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      cleanPath = `${base}/${cleanPath}`;
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
    customerContactPerson: '',
    customerEmail: '',
    customerPhone: '',
    customerGstin: '',
    customerBillingAddress: '',
    customerShippingAddress: '',
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

  const selectedCompany = useMemo(() => {
    if (!poForm.companyId) return null;
    return companies.find(c => String(c.id) === String(poForm.companyId)) || null;
  }, [poForm.companyId, companies]);

  const customerContactInfo = useMemo(() => {
    if (!poForm.companyId) return null;
    return {
      contactPerson: poForm.customerContactPerson || '—',
      email: poForm.customerEmail || '—',
      phone: poForm.customerPhone || '—',
      billingAddress: poForm.customerBillingAddress || '—',
      shippingAddress: poForm.customerShippingAddress || '—',
      gstin: poForm.customerGstin || '—'
    };
  }, [
    poForm.companyId,
    poForm.customerContactPerson,
    poForm.customerEmail,
    poForm.customerPhone,
    poForm.customerBillingAddress,
    poForm.customerShippingAddress,
    poForm.customerGstin
  ]);

  const drawingOptions = useMemo(() => {
    let drawingsList = selectedQuoteId ? quotationDrawings : allQuotationDrawings;

    if (poForm.companyId) {
      drawingsList = drawingsList.filter(d => String(d.company_id) === String(poForm.companyId));
    }

    if (selectedQuoteId) {
      return [
        { value: '', label: 'Select a drawing...' },
        ...drawingsList.map((d) => ({
          value: String(d.id),
          label: `${d.drawingNo || 'No Drawing No'} - ${d.description || 'No Description'}`
        }))
      ];
    } else {
      return [
        { value: '', label: 'Select a drawing...' },
        ...drawingsList.map((q) => ({
          value: String(q.id),
          label: `${q.drawing_no} - ${q.item_description || q.description || ''} (QRT-${String(q.parent_id || q.id).padStart(4, '0')})`
        }))
      ];
    }
  }, [selectedQuoteId, quotationDrawings, allQuotationDrawings, poForm.companyId]);

  const handleDrawingSelect = async (value) => {
    if (!value) {
      setSelectedDrawingVal('');
      return;
    }
    setSelectedDrawingVal(value);

    const quoteRequestId = parseInt(value);
    if (!selectedQuoteId) {
      const selectedQuoteItem = allQuotationDrawings.find(q => q.id === quoteRequestId);
      if (selectedQuoteItem) {
        await fetchAndApplyQuotation(selectedQuoteItem.id, selectedQuoteItem);
      }
    } else {
      const selectedDwg = quotationDrawings.find(d => d.id === quoteRequestId);
      if (!selectedDwg) return;

      const isEmptyFirstItem = poForm.items.length === 1 && 
        !poForm.items[0].drawingNo && 
        !poForm.items[0].description && 
        !poForm.items[0].quantity;

      const newItem = {
        drawingNo: selectedDwg.drawingNo || '',
        description: selectedDwg.description || '',
        hsnCode: selectedDwg.hsnCode || '',
        deliveryDate: selectedDwg.deliveryDate || '',
        quantity: selectedDwg.quantity || '',
        unit: selectedDwg.unit || 'NOS',
        rate: selectedDwg.rate || '',
        cgstPercent: selectedDwg.cgstPercent || 0,
        sgstPercent: selectedDwg.sgstPercent || 0,
        igstPercent: selectedDwg.igstPercent || 0,
        sub_assemblies: selectedDwg.sub_assemblies || []
      };

      setPoForm(prev => {
        const newItems = isEmptyFirstItem ? [newItem] : [...prev.items, newItem];
        return {
          ...prev,
          items: newItems
        };
      });

      showToast(`Added drawing ${selectedDwg.drawingNo} as a Purchase Item.`);
    }
  };

  const quotationOptions = useMemo(() => {
    const grouped = {};

    let filteredRequests = quotationRequests;
    if (poForm.companyId) {
      filteredRequests = quotationRequests.filter(q => String(q.company_id) === String(poForm.companyId));
    }

    filteredRequests.forEach(q => {
      // Ignore component snapshots
      if (q.status?.trim().toUpperCase() === 'COMPONENT') return;

      const rootId = q.parent_id || q.id;
      const chainKey = `${q.company_id}_${rootId}`;

      if (!grouped[chainKey]) {
        grouped[chainKey] = {
          id: q.id,
          display_id: rootId,
          company_id: q.company_id,
          company_name: q.company_name,
          project_name: q.project_name,
          status: q.status,
          version: q.version || 1,
          batch_id: q.batch_id,
          parent_id: q.parent_id,
          po_number: q.po_number,
          quotes: []
        };
      }

      grouped[chainKey].quotes.push(q);

      // Track the latest version inside each chain
      const currentVersion = grouped[chainKey].version || 0;
      const qVersion = q.version || 1;
      const currentStatus = (grouped[chainKey].status || '').trim().toUpperCase();
      const qStatus = (q.status || '').trim().toUpperCase();

      if (qVersion > currentVersion || (qVersion === currentVersion && qStatus === 'APPROVED' && currentStatus !== 'APPROVED')) {
        grouped[chainKey].id = q.id;
        grouped[chainKey].status = q.status;
        grouped[chainKey].version = q.version;
        grouped[chainKey].project_name = q.project_name;
        grouped[chainKey].batch_id = q.batch_id;
        grouped[chainKey].parent_id = q.parent_id;
        grouped[chainKey].po_number = q.po_number;
      }
    });

    // Filter to keep only chains where the latest version is APPROVED
    const approvedChains = Object.values(grouped).filter(group => {
      const isApproved = (group.status || '').trim().toUpperCase() === 'APPROVED';
      return isApproved;
    });

    // Sort descending by root ID
    approvedChains.sort((a, b) => b.display_id - a.display_id);

    const list = approvedChains.map(group => ({
      value: String(group.id),
      label: `QRT-${String(group.display_id).padStart(4, '0')} - ${group.company_name} (${group.project_name || 'No Project'}) ${group.version > 1 ? `(V${group.version})` : ''}`
    }));

    return [
      { value: 'clear', label: '❌ Clear Selection (Manual Entry)' },
      ...list
    ];
  }, [quotationRequests, poForm.companyId]);


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
        const data = await apiRequest('/drawings/approved');
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

  const fetchAndApplyQuotation = async (quoteId, selectedQuoteItem = null) => {
    try {
      setPoFormLoading(true);
      let targetQuoteId = quoteId;
      
      // Resolve option value in quotationOptions to ensure correct highlight in dropdown
      const hasDirectOption = quotationOptions.some(opt => opt.value === String(quoteId));
      if (!hasDirectOption) {
        const basicQuote = quotationRequests.find(q => q.id === parseInt(quoteId));
        if (basicQuote) {
          const rootId = basicQuote.parent_id || basicQuote.id;
          const prefix = `QRT-${String(rootId).padStart(4, '0')}`;
          const foundOpt = quotationOptions.find(opt => opt.label.startsWith(prefix));
          if (foundOpt) {
            targetQuoteId = parseInt(foundOpt.value);
          }
        }
      }
      setSelectedQuoteId(String(targetQuoteId));

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

      setSelectedQuoteContact({
        contactPerson: quote.contact_person || '—',
        email: quote.client_email || '—',
        phone: quote.client_phone || '—',
        billingAddress: quote.client_address || '—',
        shippingAddress: quote.client_address || '—'
      });

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
            id: item.id || item.qr_id,
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

      setQuotationDrawings(items);

      // Pre-select host company from quotation if saved, or fall back to active global company
      const hostId = quote.host_company_id || quote.hostCompanyId || null;
      if (hostId) {
        setSelectedHostId(String(hostId));
        const matchedHost = hostCompanies.find(h => String(h.id) === String(hostId));
        setSelectedHostCompany(matchedHost || null);
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

      let targetItems = [];
      if (selectedQuoteItem) {
        const matchedDwg = items.find(it => 
          String(it.drawingNo).trim().toUpperCase() === String(selectedQuoteItem.drawing_no).trim().toUpperCase()
        );
        if (matchedDwg) {
          targetItems = [matchedDwg];
        } else {
          const qty = parseFloat(selectedQuoteItem.item_qty || selectedQuoteItem.quantity) || 0;
          const totalAmount = parseFloat(selectedQuoteItem.total_amount || selectedQuoteItem.total) || 0;
          const unitRate = qty > 0 ? (totalAmount / qty) : totalAmount;
          const gst = selectedQuoteItem.gst_percentage || 18;
          targetItems = [{
            drawingNo: (selectedQuoteItem.drawing_no || '').toUpperCase(),
            description: selectedQuoteItem.item_description || selectedQuoteItem.description || '',
            hsnCode: selectedQuoteItem.hsn_code || '',
            deliveryDate: selectedQuoteItem.delivery_date ? new Date(selectedQuoteItem.delivery_date).toISOString().split('T')[0] : '',
            quantity: qty,
            unit: selectedQuoteItem.item_unit || 'NOS',
            rate: unitRate.toFixed(2),
            cgstPercent: gst / 2,
            sgstPercent: gst / 2,
            igstPercent: 0,
            sub_assemblies: []
          }];
        }
      } else {
        targetItems = items;
      }

      const comp = companies.find(c => String(c.id) === String(quote.company_id));
      setPoForm(prev => ({
        ...prev,
        companyId: quote.company_id,
        projectName: quote.project_name || '',
        customerContactPerson: quote.contact_person || '',
        customerEmail: quote.client_email || '',
        customerPhone: quote.client_phone || '',
        customerGstin: comp?.gstin || '',
        customerBillingAddress: quote.client_address || '',
        customerShippingAddress: quote.client_address || '',
        items: targetItems.length > 0 ? targetItems : prev.items
      }));

      showToast(`Loaded details from quotation QRT-${String(quoteId).padStart(4, '0')}`);
    } catch (error) {
      console.error('Error fetching quotation details:', error);
      showToast('Failed to fetch full quotation details');
    } finally {
      setPoFormLoading(false);
    }
  };

  const handleQuotationSelect = async (quoteId) => {
    if (quoteId === 'clear' || !quoteId) {
      setSelectedQuoteId('');
      setSelectedQuoteContact(null);
      setQuotationDrawings([]);
      setSelectedDrawingVal('');
      return;
    }
    await fetchAndApplyQuotation(quoteId, null);
  };

  const filteredPOs = useMemo(() => {
    return customerPos.filter(po => {
      const matchesItems = (po.items || []).some(item =>
        (item.drawingNo || item.drawing_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sub_assemblies || []).some(sa =>
          (sa.drawingNo || sa.drawing_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          sa.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

      const matchesSearch =
        po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        matchesItems;

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
          cgstPercent: 9,
          sgstPercent: 9,
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

    if (field === 'drawingNo') {
      newItems[index].sub_assemblies = [];
      let matchedQuoteDwg = quotationDrawings.find(d =>
        String(d.drawingNo || d.drawing_no || '').trim().toUpperCase() === String(value).trim().toUpperCase()
      );

      let isFromAllQuotes = false;
      if (!matchedQuoteDwg) {
        matchedQuoteDwg = allQuotationDrawings.find(q =>
          String(q.drawing_no || q.drawingNo || '').trim().toUpperCase() === String(value).trim().toUpperCase()
        );
        if (matchedQuoteDwg) {
          isFromAllQuotes = true;
        }
      }

      if (matchedQuoteDwg) {
        const masterDwg = allDrawings.find(d =>
          String(d.drawing_no).trim().toUpperCase() === String(value).trim().toUpperCase()
        );
        const subAssemblies = (masterDwg && masterDwg.sub_assemblies && masterDwg.sub_assemblies.length > 0)
          ? masterDwg.sub_assemblies.map(sa => ({
              drawingNo: sa.drawingNo || sa.drawing_no || '',
              description: sa.description || '',
              quantity: sa.quantity || 0,
              unit: sa.unit || 'NOS',
              rate: sa.rate || sa.bom_cost || 0,
              cgstPercent: 0,
              sgstPercent: 0,
              igstPercent: 0,
              hsnCode: sa.hsn_code || sa.hsnCode || masterDwg.hsn_code || '',
              deliveryDate: sa.delivery_date || sa.deliveryDate || (masterDwg.delivery_date ? new Date(masterDwg.delivery_date).toISOString().split('T')[0] : '')
            }))
          : (matchedQuoteDwg.sub_assemblies || []);

        if (isFromAllQuotes) {
          const qty = parseFloat(matchedQuoteDwg.quantity || matchedQuoteDwg.item_qty) || '';
          const totalAmount = parseFloat(matchedQuoteDwg.total || matchedQuoteDwg.total_amount) || 0;
          const rate = qty > 0 ? (totalAmount / qty) : (parseFloat(matchedQuoteDwg.rate || matchedQuoteDwg.approved_rate) || totalAmount || '');
          const gst = parseFloat(matchedQuoteDwg.gst_percentage) || 18;

          newItems[index].description = matchedQuoteDwg.description || matchedQuoteDwg.item_description || '';
          newItems[index].hsnCode = matchedQuoteDwg.hsnCode || matchedQuoteDwg.hsn_code || '';
          newItems[index].unit = matchedQuoteDwg.unit || matchedQuoteDwg.item_unit || 'NOS';
          newItems[index].quantity = qty;
          newItems[index].rate = typeof rate === 'number' ? rate.toFixed(2) : rate;
          if (matchedQuoteDwg.deliveryDate || matchedQuoteDwg.delivery_date) {
            newItems[index].deliveryDate = new Date(matchedQuoteDwg.deliveryDate || matchedQuoteDwg.delivery_date).toISOString().split('T')[0];
          }
          newItems[index].cgstPercent = gst / 2;
          newItems[index].sgstPercent = gst / 2;
          newItems[index].igstPercent = 0;
          newItems[index].sub_assemblies = subAssemblies;
        } else {
          newItems[index].description = matchedQuoteDwg.description || '';
          newItems[index].hsnCode = matchedQuoteDwg.hsnCode || matchedQuoteDwg.hsn_code || '';
          newItems[index].unit = matchedQuoteDwg.unit || 'NOS';
          newItems[index].quantity = matchedQuoteDwg.quantity || '';
          newItems[index].rate = matchedQuoteDwg.rate || '';
          if (matchedQuoteDwg.deliveryDate || matchedQuoteDwg.delivery_date) {
            newItems[index].deliveryDate = new Date(matchedQuoteDwg.deliveryDate || matchedQuoteDwg.delivery_date).toISOString().split('T')[0];
          }
          newItems[index].cgstPercent = matchedQuoteDwg.cgstPercent || 0;
          newItems[index].sgstPercent = matchedQuoteDwg.sgstPercent || 0;
          newItems[index].igstPercent = matchedQuoteDwg.igstPercent || 0;
          newItems[index].sub_assemblies = subAssemblies;
        }
      } else {
        const matchedDwg = allDrawings.find(d =>
          String(d.drawing_no).trim().toUpperCase() === String(value).trim().toUpperCase()
        );
        if (matchedDwg) {
          newItems[index].description = matchedDwg.drawing_description || matchedDwg.description || '';
          newItems[index].hsnCode = matchedDwg.hsn_code || '';
          newItems[index].unit = matchedDwg.unit || 'NOS';
          newItems[index].quantity = matchedDwg.qty || matchedDwg.quantity || '';
          if (matchedDwg.bom_cost) {
            newItems[index].rate = matchedDwg.bom_cost;
          }
          if (matchedDwg.delivery_date) {
            newItems[index].deliveryDate = new Date(matchedDwg.delivery_date).toISOString().split('T')[0];
          }
          // Sync sub-assemblies if they exist on the drawing
          if (matchedDwg.sub_assemblies && matchedDwg.sub_assemblies.length > 0) {
            newItems[index].sub_assemblies = matchedDwg.sub_assemblies.map(sa => ({
              drawingNo: sa.drawingNo || sa.drawing_no || '',
              description: sa.description || '',
              quantity: sa.quantity || 0,
              unit: sa.unit || 'NOS',
              rate: sa.rate || 0,
              cgstPercent: 0,
              sgstPercent: 0,
              igstPercent: 0,
              hsnCode: sa.hsn_code || sa.hsnCode || matchedDwg.hsn_code || '',
              deliveryDate: sa.delivery_date || sa.deliveryDate || (matchedDwg.delivery_date ? new Date(matchedDwg.delivery_date).toISOString().split('T')[0] : '')
            }));
          }
        }
      }
    }
    setPoForm(prev => ({ ...prev, items: newItems }))
  }

  const closePoForm = () => {
    setShowPoForm(false)
    setFormMode('CREATE')
    setEditingPoId(null)
    setAttachments([])
    setExistingAttachments([])
    setLocalError('')
    if (window.location.pathname !== '/sales/customer-po') {
      window.history.pushState({}, '', '/sales/customer-po');
    }
    setSelectedQuoteId('')
    setSelectedQuoteContact(null)
    setQuotationDrawings([])
    setSelectedDrawingVal('')
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
      customerContactPerson: '',
      customerEmail: '',
      customerPhone: '',
      customerGstin: '',
      customerBillingAddress: '',
      customerShippingAddress: '',
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
    setLocalError('');
    if (poId) {
      setEditingPoId(poId);
      setPoFormLoading(true);
      setShowPoForm(true);
      try {
        const data = await apiRequest(`/customer-pos/${poId}`);
        setExistingAttachments(data.pdf_path ? data.pdf_path.split(',').map(f => f.trim()).filter(Boolean) : []);
        setAttachments([]);
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
          customerContactPerson: data.contact_person || '',
          customerEmail: data.email || '',
          customerPhone: data.phone || '',
          customerGstin: data.gstin || '',
          customerBillingAddress: data.billing_address || '',
          customerShippingAddress: data.shipping_address || '',
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
            dispatched_qty: item.dispatched_qty || 0,
            sub_assemblies: (() => {
              const seen = new Set();
              return (item.sub_assemblies || []).filter(sa => {
                const code = String(sa.component_code || sa.item_code || sa.drawing_no || sa.drawingNo || sa.description || '').trim().toLowerCase();
                if (seen.has(code)) return false;
                seen.add(code);
                return true;
              }).map(sa => ({
                ...sa,
                drawingNo: (sa.drawing_no || sa.drawingNo || sa.component_code || sa.item_code || '').toUpperCase(),
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
        const hasContact = (data.contact_person && data.contact_person !== '—') ||
          (data.email && data.email !== '—') ||
          (data.phone && data.phone !== '—');
        if (hasContact) {
          setSelectedQuoteContact({
            contactPerson: data.contact_person || '—',
            email: data.email || '—',
            phone: data.phone || '—',
            billingAddress: data.billing_address || '—',
            shippingAddress: data.shipping_address || '—'
          });
        } else {
          setSelectedQuoteContact(null);
        }

        // Auto-populate Drawing and Quotation fields for VIEW/EDIT modes
        if (data.items && data.items.length > 0) {
          const firstItem = data.items[0];
          const matchedDwg = allQuotationDrawings.find(q => 
            String(q.drawing_no).trim().toUpperCase() === String(firstItem.drawing_no || firstItem.drawingNo).trim().toUpperCase()
          );
          if (matchedDwg) {
            setSelectedDrawingVal(String(matchedDwg.id));
            setSelectedQuoteId(String(matchedDwg.id));
            try {
              const versions = await apiRequest(`/quotation-requests/versions/${matchedDwg.id}`);
              let quote = null;
              for (const vGroup of versions) {
                const match = vGroup.items?.find(it => it.id === matchedDwg.id);
                if (match) { quote = vGroup; break; }
              }
              if (quote && quote.items) {
                const items = quote.items.filter(it => (it.item_group || it.item_type || '').toUpperCase() !== 'SA').map(item => {
                  const qty = parseFloat(item.item_qty || item.quantity) || 0;
                  const totalAmount = parseFloat(item.total_amount || item.total) || 0;
                  const unitRate = qty > 0 ? (totalAmount / qty) : totalAmount;
                  const gst = item.gst_percentage || 18;
                  return {
                    id: item.id || item.qr_id,
                    drawingNo: (item.drawing_no || item.drawingNo || '') !== '—' ? (item.drawing_no || item.drawingNo || '').toUpperCase() : '',
                    description: item.item_description || item.description,
                    hsnCode: item.hsn_code || item.hsnCode || '',
                    deliveryDate: item.delivery_date || item.deliveryDate ? new Date(item.delivery_date || item.deliveryDate).toISOString().split('T')[0] : '',
                    quantity: qty,
                    unit: item.item_unit || item.unit || 'NOS',
                    rate: unitRate.toFixed(2),
                    cgstPercent: gst / 2,
                    sgstPercent: gst / 2,
                    igstPercent: 0,
                    item_group: item.item_group,
                    sub_assemblies: []
                  };
                });
                setQuotationDrawings(items);
              }
            } catch (err) {
              console.error('Error fetching version details for VIEW/EDIT modes:', err);
            }
          }
        }
      } catch (error) {
        showToast(error.message || 'Failed to fetch PO details');
        closePoForm();
      } finally {
        setPoFormLoading(false);
      }
    } else {
      // Full reset so CREATE mode always opens a blank form
      setEditingPoId(null);
      setSelectedQuoteId('');
      setSelectedQuoteContact(null);
      setQuotationDrawings([]);
      setSelectedDrawingVal('');
      setSelectedHostId('');
      setSelectedHostCompany(null);
      setAttachments([]);
      setExistingAttachments([]);
      setLocalError('');
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
        customerContactPerson: '',
        customerEmail: '',
        customerPhone: '',
        customerGstin: '',
        customerBillingAddress: '',
        customerShippingAddress: '',
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
      });
      setShowPoForm(true);
      if (window.location.pathname !== '/sales/customer-po/new-po') {
        window.history.pushState({}, '', '/sales/customer-po/new-po');
      }
    }
  };

  const handlePoSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    if (!poForm.companyId) {
      const msg = 'Please select a company';
      showToast(msg)
      setLocalError(msg)
      return
    }
    if (!poForm.poNumber || !poForm.poNumber.trim()) {
      const msg = 'Please enter a PO Number';
      showToast(msg)
      setLocalError(msg)
      return
    }
    if (!poForm.poDate) {
      const msg = 'Please select a PO Date';
      showToast(msg)
      setLocalError(msg)
      return
    }

    // Validate Items
    for (let i = 0; i < poForm.items.length; i++) {
      const item = poForm.items[i];
      const itemLabel = `Line Item ${i + 1}`;
      if (!item.drawingNo || !item.drawingNo.trim()) {
        const msg = `Drawing No is required for ${itemLabel}`;
        showToast(msg)
        setLocalError(msg)
        return;
      }
      if (!item.description || !item.description.trim()) {
        const msg = `Description is required for ${itemLabel}`;
        showToast(msg)
        setLocalError(msg)
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        const msg = `Valid Quantity is required for ${itemLabel}`;
        showToast(msg)
        setLocalError(msg)
        return;
      }
      if (!item.unit || !item.unit.trim()) {
        const msg = `Unit is required for ${itemLabel}`;
        showToast(msg)
        setLocalError(msg)
        return;
      }
      if (!item.rate || Number(item.rate) <= 0) {
        const msg = `Valid Rate is required for ${itemLabel}`;
        showToast(msg)
        setLocalError(msg)
        return;
      }
    }

    if (attachments.length === 0 && existingAttachments.length === 0) {
      const msg = 'Please upload at least one PO / Document attachment';
      showToast(msg)
      setLocalError(msg)
      return
    }

    setPoFormLoading(true)
    try {
      const url = formMode === 'EDIT' ? `/customer-pos/${editingPoId}` : '/customer-pos';
      const method = formMode === 'EDIT' ? 'PUT' : 'POST';

      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
      const token = localStorage.getItem('authToken');

      const formData = new FormData();
      formData.append('companyId', poForm.companyId);
      formData.append('projectName', poForm.projectName || '');
      formData.append('poNumber', poForm.poNumber || '');
      formData.append('poDate', poForm.poDate || '');
      formData.append('poVersion', poForm.poVersion || '1.0');
      formData.append('orderType', poForm.orderType || 'STANDARD');
      formData.append('currency', poForm.currency || 'INR');
      formData.append('paymentTerms', poForm.paymentTerms || '');
      formData.append('creditDays', poForm.creditDays || '');
      formData.append('remarks', poForm.remarks || '');
      formData.append('hostCompanyId', selectedHostId || '');
      
      formData.append('contactPerson', poForm.customerContactPerson || '');
      formData.append('email', poForm.customerEmail || '');
      formData.append('phone', poForm.customerPhone || '');
      formData.append('gstin', poForm.customerGstin || '');
      formData.append('billingAddress', poForm.customerBillingAddress || '');
      formData.append('shippingAddress', poForm.customerShippingAddress || '');

      const mappedItems = poForm.items.map(item => ({
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
      }));
      formData.append('items', JSON.stringify(mappedItems));

      if (formMode === 'EDIT') {
        formData.append('existingAttachments', existingAttachments.join(','));
      }

      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`${baseUrl}${url}`, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.error || `Failed to ${formMode === 'EDIT' ? 'update' : 'create'} PO`);
      }

      showToast(`Customer PO ${formMode === 'EDIT' ? 'updated' : 'created'} successfully`)
      closePoForm()
      if (onRefresh) onRefresh()
    } catch (error) {
      showToast(error.message)
    } finally {
      setPoFormLoading(false)
    }
  }

  const handleDownloadPdf = async (poId, poNumber, includeDispatchStatus = false, balanceReport = false, sentReport = false) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
      const token = localStorage.getItem('authToken');

      let queryParams = [];
      if (includeDispatchStatus) queryParams.push('includeDispatchStatus=true');
      if (balanceReport) queryParams.push('balanceReport=true');
      if (sentReport) queryParams.push('sentReport=true');
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

      const response = await fetch(`${baseUrl}/customer-pos/${poId}/pdf${queryString}`, {
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

  const handleDownloadBalanceReport = () => {
    try {
      const headers = ['Drawing No', 'Description', 'Ordered Qty', 'Dispatched Qty', 'Balance Qty', 'Unit', 'Rate', 'Basic Amount', 'Tax %', 'Total Amount', 'Status'];
      const rows = poForm.items.map(item => {
        const ordered = parseFloat(item.quantity) || 0;
        const dispatched = parseFloat(item.dispatched_qty) || 0;
        const balance = Math.max(ordered - dispatched, 0);
        const basicAmount = ordered * (parseFloat(item.rate) || 0);
        const taxPercent = (parseFloat(item.cgstPercent) || 0) + (parseFloat(item.sgstPercent) || 0) + (parseFloat(item.igstPercent) || 0);
        const totalAmount = basicAmount * (1 + taxPercent / 100);

        let status = 'Pending Dispatch';
        if (dispatched >= ordered && ordered > 0) {
          status = 'Fully Dispatched';
        } else if (dispatched > 0) {
          status = 'Partially Dispatched';
        }

        return [
          item.drawingNo || '',
          item.description || '',
          ordered,
          dispatched,
          balance,
          item.unit || '',
          item.rate || 0,
          basicAmount.toFixed(2),
          taxPercent + '%',
          totalAmount.toFixed(2),
          status
        ];
      });

      poForm.items.forEach(item => {
        if (item.sub_assemblies && item.sub_assemblies.length > 0) {
          item.sub_assemblies.forEach(sa => {
            const ordered = (parseFloat(sa.quantity) || 0) * (parseFloat(item.quantity) || 0);
            rows.push([
              `-- ${sa.drawingNo || ''}`,
              sa.description || '',
              ordered,
              '—',
              '—',
              sa.unit || '',
              sa.rate || 0,
              (ordered * (parseFloat(sa.rate) || 0)).toFixed(2),
              '—',
              (ordered * (parseFloat(sa.rate) || 0)).toFixed(2),
              '—'
            ]);
          });
        }
      });

      const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Balance_Dispatch_Report_${poForm.poNumber || 'PO'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
            onClick={async () => {
              // Pre-fill form from the row details
              setFormMode('CREATE');
              setEditingPoId(null);
              setSelectedQuoteId('');
              setSelectedQuoteContact(null);
              setQuotationDrawings([]);
              setSelectedDrawingVal('');
              setAttachments([]);
              setExistingAttachments([]);
              setLocalError('');

              if (row.host_company_id) {
                setSelectedHostId(String(row.host_company_id));
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

              // Fetch details of the selected PO to populate items correctly
              setPoFormLoading(true);
              setShowPoForm(true);
              try {
                const data = await apiRequest(`/customer-pos/${row.id}`);
                const year = new Date().getFullYear();
                const count = (customerPos?.length || 0) + 1;
                const autoPo = `PO-${year}-${count.toString().padStart(3, '0')}`;

                setPoForm({
                  companyId: data.company_id || '',
                  projectName: data.project_name || '',
                  poNumber: autoPo, // Generate and set fresh PO number here
                  poDate: new Date().toISOString().split('T')[0],
                  poVersion: '1.0',
                  orderType: data.order_type || 'STANDARD',
                  currency: data.currency || 'INR',
                  paymentTerms: data.payment_terms || '',
                  creditDays: data.credit_days || '',
                  remarks: data.remarks || '',
                  customerContactPerson: data.contact_person || '',
                  customerEmail: data.email || '',
                  customerPhone: data.phone || '',
                  customerGstin: data.gstin || '',
                  customerBillingAddress: data.billing_address || '',
                  customerShippingAddress: data.shipping_address || '',
                  items: (data.items || []).map(item => ({
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
                    sub_assemblies: (item.sub_assemblies || []).map(sa => ({
                      drawingNo: sa.drawing_no || sa.drawingNo || '',
                      description: sa.description || '',
                      hsnCode: sa.hsn_code || sa.hsnCode || '',
                      deliveryDate: sa.delivery_date ? new Date(sa.delivery_date).toISOString().split('T')[0] : '',
                      quantity: sa.quantity || 0,
                      unit: sa.unit || 'NOS',
                      rate: sa.rate || 0,
                      item_group: sa.item_group || 'SA'
                    }))
                  }))
                });
              } catch (error) {
                console.error('Error pre-filling PO items:', error);
                showToast('Failed to load item details for creation');
              } finally {
                setPoFormLoading(false);
              }

              if (window.location.pathname !== '/sales/customer-po/new-po') {
                window.history.pushState({}, '', '/sales/customer-po/new-po');
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-[10px] font-semibold rounded shadow-sm shadow-indigo-200 transition-all duration-200 active:scale-95 border border-indigo-500/30"
            title="Create New Purchase Order"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            Create PO
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
            placeholder="Search by PO number, client, project, or drawing..."
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
          <div className="relative w-full max-w-7xl bg-white shadow-2xl rounded  flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
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
                  <>
                    <button
                      type="button"
                      onClick={() => setFormMode('EDIT')}
                      className="p-2 rounded hover:bg-amber-100 transition-all text-amber-600 active:scale-90 bg-amber-50 border border-amber-100 flex items-center gap-2 text-xs "
                      title="Switch to Edit Mode"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(editingPoId, poForm.poNumber, true, false, true)}
                      className="p-2 rounded hover:bg-blue-100 transition-all text-blue-600 active:scale-90 bg-blue-50 border border-blue-100 flex items-center gap-2 text-xs "
                      title="Download Customer PO PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download send Customer PO
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(editingPoId, poForm.poNumber, true, true, false)}
                      className="p-2 rounded hover:bg-emerald-100 transition-all text-emerald-600 active:scale-90 bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-xs "
                      title="Download Balance Dispatch Report PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Download Balance Dispatch Report
                    </button>
                  </>
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
                          <span className={`text-[9px] mt-1.5 px-2 py-0.5 rounded-full font-semibold border ${selectedHostCompany.status === 'ACTIVE'
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}>
                            {selectedHostCompany.status === 'ACTIVE' ? 'Active Global Billing' : 'Inactive'}
                          </span>
                        </div>

                        <div className="space-y-2 p-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Office & Contact Details</p>
                          <div className="space-y-1.5 text-slate-600 text-xs">
                            <div className="flex gap-1.5 items-start">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed whitespace-pre-line">{selectedHostCompany.company_address || '—'}</span>
                            </div>
                            {selectedHostCompany.contact_person && (
                              <div className="text-[11px] text-slate-500">
                                Contact Person: <span className="font-semibold text-slate-700">{selectedHostCompany.contact_person}</span>
                              </div>
                            )}
                            {(selectedHostCompany.email || selectedHostCompany.phone) && (
                              <div className="text-[10px] text-slate-500 space-y-0.5">
                                {selectedHostCompany.email && <p>Email: <span className="text-slate-700">{selectedHostCompany.email}</span></p>}
                                {selectedHostCompany.phone && <p>Mobile: <span className="text-slate-700">{selectedHostCompany.phone}</span></p>}
                              </div>
                            )}
                            <div className="pt-1 flex flex-col gap-1 border-t border-slate-100/60 mt-1">
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

                  <div className="grid grid-cols-1">
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">Company / Client *</label>
                      <select
                        disabled={formMode === 'VIEW'}
                        value={poForm.companyId}
                        onChange={(e) => {
                          const val = e.target.value;
                          const comp = companies.find(c => String(c.id) === String(val));
                          
                          let customerContactPerson = '';
                          let customerEmail = '';
                          let customerPhone = '';
                          let customerGstin = '';
                          let customerBillingAddress = '';
                          let customerShippingAddress = '';

                          if (comp) {
                            const primaryContact = comp.contacts?.find(ct => ct.contact_type === 'PRIMARY') || comp.contacts?.[0];
                            const billing = comp.addresses?.find(address => address.address_type === 'BILLING') || {};
                            const shipping = comp.addresses?.find(address => address.address_type === 'SHIPPING') || {};

                            const billingAddressStr = [billing.line1, billing.line2, billing.city, billing.state, billing.pincode].filter(Boolean).join(', ');
                            const shippingAddressStr = [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ');

                            customerContactPerson = primaryContact?.name || comp.contact_person || '';
                            customerEmail = primaryContact?.email || comp.email || comp.contact_email || '';
                            customerPhone = primaryContact?.phone || comp.phone || comp.contact_mobile || '';
                            customerGstin = comp.gstin || '';
                            customerBillingAddress = billingAddressStr || comp.billing_address || '';
                            customerShippingAddress = shippingAddressStr || comp.shipping_address || '';
                          }

                          setPoForm(prev => ({
                            ...prev,
                            companyId: val,
                            customerContactPerson,
                            customerEmail,
                            customerPhone,
                            customerGstin,
                            customerBillingAddress,
                            customerShippingAddress
                          }));
                          setSelectedQuoteId('');
                          setSelectedDrawingVal('');
                          setSelectedQuoteContact(null);
                        }}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700 appearance-none font-medium"
                      >
                        <option value="">Select Company</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.company_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {poForm.companyId && (
                    <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 pb-1.5 mb-2 border-b border-slate-200/40">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[11px] font-semibold text-slate-700">Customer Details (Editable)</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 font-medium">Contact Person</label>
                          <input
                            type="text"
                            disabled={formMode === 'VIEW'}
                            value={poForm.customerContactPerson || ''}
                            onChange={(e) => setPoForm(prev => ({ ...prev, customerContactPerson: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-semibold"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 font-medium">Email Address</label>
                          <input
                            type="email"
                            disabled={formMode === 'VIEW'}
                            value={poForm.customerEmail || ''}
                            onChange={(e) => setPoForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-semibold"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 font-medium">Phone Number</label>
                          <input
                            type="text"
                            disabled={formMode === 'VIEW'}
                            value={poForm.customerPhone || ''}
                            onChange={(e) => setPoForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-semibold"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 font-medium">GSTIN</label>
                          <input
                            type="text"
                            disabled={formMode === 'VIEW'}
                            value={poForm.customerGstin || ''}
                            onChange={(e) => setPoForm(prev => ({ ...prev, customerGstin: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-mono font-semibold"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 font-medium">Billing Address</label>
                          <input
                            type="text"
                            disabled={formMode === 'VIEW'}
                            value={poForm.customerBillingAddress || ''}
                            onChange={(e) => setPoForm(prev => ({ ...prev, customerBillingAddress: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-semibold"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 font-medium">Shipping Address</label>
                          <input
                            type="text"
                            disabled={formMode === 'VIEW'}
                            value={poForm.customerShippingAddress || ''}
                            onChange={(e) => setPoForm(prev => ({ ...prev, customerShippingAddress: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs  text-slate-400   ml-1">PO Number *</label>
                      <input
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

                  <div className="overflow-x-auto rounded border-2 border-slate-100 bg-white min-h-[280px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-100">
                          <th className="p-2  text-xs  text-slate-400   text-left w-96">Drawing No *</th>
                          <th className="p-2  text-xs  text-slate-400   text-left">Description *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">HSN Code</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-28">Item Delivery</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-16">Qty *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-22">Dispatch Progress</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-12">Unit</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-20">Rate *</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-10">CGST%</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-10">SGST%</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-10">IGST%</th>
                          <th className="p-2  text-xs  text-slate-400   text-right pr-6 w-24">Total</th>
                          <th className="p-2  text-xs  text-slate-400   text-center w-10">Action</th>
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
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs font-mono font-bold text-slate-700 block px-1 max-w-[380px]" title={item.drawingNo}>
                                    {item.drawingNo?.toUpperCase() || '—'}
                                  </span>
                                ) : (
                                  <SearchableSelect
                                    options={allDrawings.map(d => ({
                                      value: d.drawing_no,
                                      label: `${d.drawing_no} - ${d.drawing_description || d.description || ''}`
                                    }))}
                                    value={item.drawingNo?.toUpperCase() || ''}
                                    onChange={(e) => handleItemChange(index, 'drawingNo', e.target.value.toUpperCase())}
                                    placeholder="Search Drawing No..."
                                    allowCustom={true}
                                    openUpwards={false}
                                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-700"
                                  />
                                )}
                              </td>
                              <td className="p-2">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs font-semibold text-slate-700 block min-w-[140px] px-1 truncate max-w-[200px]" title={item.description}>
                                    {item.description || '—'}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                    placeholder="Item description..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs text-slate-600 font-medium block text-center px-1">
                                    {item.hsnCode || '—'}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.hsnCode || ''}
                                    onChange={(e) => handleItemChange(index, 'hsnCode', e.target.value)}
                                    placeholder="HSN..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs text-slate-600 font-medium block text-center px-1">
                                    {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString('en-GB') : '—'}
                                  </span>
                                ) : (
                                  <input
                                    type="date"
                                    value={item.deliveryDate || ''}
                                    onChange={(e) => handleItemChange(index, 'deliveryDate', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-700"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs font-semibold text-slate-800 block text-center px-1">
                                    {item.quantity || 0}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-800"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle min-w-[88px]">
                                {(() => {
                                  const ordered = parseFloat(item.quantity) || 0;
                                  const dispatched = parseFloat(item.dispatched_qty) || 0;
                                  const percent = ordered > 0 ? Math.min(Math.round((dispatched / ordered) * 100), 100) : 0;

                                  return (
                                    <div className="flex flex-col w-full px-1 max-w-[140px] mx-auto">
                                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700 leading-tight">
                                        <span>
                                          {dispatched % 1 === 0 ? parseInt(dispatched) : dispatched}/{ordered % 1 === 0 ? parseInt(ordered) : ordered}
                                        </span>
                                        <span className="text-blue-600">
                                          {percent}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                                        <div
                                          className="bg-blue-600 h-1 rounded-full transition-all duration-350"
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs text-slate-600 font-medium block text-center px-1">{item.unit || 'Nos'}</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600 "
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs font-mono font-semibold text-slate-700 block text-center px-1">{formatCurrency(item.rate)}</span>
                                ) : (
                                  <input
                                    type="number"
                                    value={item.rate}
                                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                    className="w-full bg-indigo-50 border border-indigo-100 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-indigo-600 placeholder:text-indigo-200"
                                    placeholder="0.00"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs text-slate-500 block text-center px-1">{parseFloat(item.cgstPercent) || 0}%</span>
                                ) : (
                                  <input
                                    type="number"
                                    value={item.cgstPercent}
                                    onChange={(e) => handleItemChange(index, 'cgstPercent', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs text-slate-500 block text-center px-1">{parseFloat(item.sgstPercent) || 0}%</span>
                                ) : (
                                  <input
                                    type="number"
                                    value={item.sgstPercent}
                                    onChange={(e) => handleItemChange(index, 'sgstPercent', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-center align-middle">
                                {formMode === 'VIEW' ? (
                                  <span className="text-xs text-slate-500 block text-center px-1">{parseFloat(item.igstPercent) || 0}%</span>
                                ) : (
                                  <input
                                    type="number"
                                    value={item.igstPercent}
                                    onChange={(e) => handleItemChange(index, 'igstPercent', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded  p-2 text-xs  text-center focus:border-indigo-500 focus:bg-white outline-none transition-all  text-slate-600"
                                  />
                                )}
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
                              const parentQty = (item.quantity === '' || item.quantity === undefined || item.quantity === null || isNaN(parseFloat(item.quantity))) ? 1 : (parseFloat(item.quantity) || 0);
                              const saQty = (parseFloat(sa.quantity || 0) * parentQty);
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
                                  <td className="p-2 border-b border-slate-100"></td>
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
                          <td colSpan="11" className="px-4 p-2 text-right text-xs  text-slate-400  ">Grand Total (Incl. Taxes)</td>
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

                {/* Attachment PO & Documents Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm text-slate-800">Attachment PO & Documents *</h3>
                  </div>

                  {/* Drop/Select Zone (only visible if not VIEW mode) */}
                  {formMode !== 'VIEW' && (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-indigo-300 transition-all cursor-pointer bg-slate-50/50 group relative">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setAttachments(prev => [...prev, ...files]);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-all">
                          <Upload className="w-5.5 h-5.5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700">Click or drag files here to upload PO / Documents</p>
                        <p className="text-[10px] text-slate-400">PDF, PNG, JPG, JPEG (Multiple files allowed)</p>
                      </div>
                    </div>
                  )}

                  {/* List of Attachments */}
                  {((existingAttachments && existingAttachments.length > 0) || (attachments && attachments.length > 0)) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {/* Existing Attachments */}
                      {existingAttachments.map((file, idx) => {
                        const rawName = file.split('/').pop() || file.split('\\').pop() || '';
                        const parts = rawName.split('-');
                        const fileName = parts.length > 1 ? parts.slice(1).join('-') : rawName;
                        return (
                          <div key={`existing-${idx}`} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/60 rounded-lg hover:bg-slate-100/70 transition-all">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-xs text-slate-700 truncate font-semibold" title={fileName}>{fileName}</span>
                                <span className="text-[9px] text-slate-400 font-medium">Existing Document</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenPdf(file)}
                                className="p-1 bg-white border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition-all hover:bg-indigo-50 active:scale-95"
                                title="View Document"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {formMode !== 'VIEW' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExistingAttachments(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all hover:bg-rose-50 active:scale-95"
                                  title="Delete Document"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Staged New Attachments */}
                      {attachments.map((file, idx) => (
                        <div key={`staged-${idx}`} className="flex items-center justify-between p-2.5 bg-indigo-50/20 border border-indigo-100/60 rounded-lg hover:bg-indigo-50/40 transition-all">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-xs text-indigo-950 truncate font-semibold" title={file.name}>{file.name}</span>
                              <span className="text-[9px] text-indigo-600 font-medium">Staged - {(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          {formMode !== 'VIEW' && (
                            <button
                              type="button"
                              onClick={() => {
                                setAttachments(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1 bg-white border border-indigo-100/40 rounded text-indigo-400 hover:text-rose-600 hover:border-rose-100 transition-all hover:bg-rose-50 active:scale-95 shrink-0"
                              title="Remove Document"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200/60 rounded-lg text-slate-400 text-xs mt-2">
                      No documents attached.
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-2 border-t border-slate-100 bg-slate-50/80 backdrop-blur-md flex flex-col sticky bottom-0 z-10">
              {localError && (
                <div className="p-2.5 mb-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="font-semibold">{localError}</span>
                </div>
              )}
              <div className="flex items-center justify-between w-full">
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
