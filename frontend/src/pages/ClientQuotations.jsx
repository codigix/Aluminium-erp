import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { Card, StatusBadge, DataTable } from '../components/ui.jsx';
import { MessageSquare, Send, X, User, ShieldCheck, RotateCw, Save, Check, FileText, CheckCircle, Mail, ClipboardList, Eye, Trash2, Loader2, Download, Package, ChevronDown, ChevronUp, History, Search, CheckCheck } from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

// Robust URL construction
const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // 1. Determine base URL (priority: VITE_UPLOAD_URL -> API_BASE)
  let base = UPLOAD_BASE || API_BASE;
  if (base.endsWith('/')) base = base.slice(0, -1);
  
  // 2. Clean the incoming path
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // 3. Prevent double 'uploads/' if base already includes it
  if (base.toLowerCase().endsWith('/uploads') && cleanPath.toLowerCase().startsWith('uploads/')) {
    cleanPath = cleanPath.slice(8);
  }
  
  const url = `${base}/${cleanPath}`;
  
  if (url.startsWith('http')) return url;
  return window.location.origin + (url.startsWith('/') ? url : '/' + url);
};

const ClientQuotations = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'sent', or 'received'
  const [groupedByClient, setGroupedByClient] = useState({});
  const [sentQuotations, setSentQuotations] = useState([]);
  const [receivedQuotations, setReceivedQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedClientName, setExpandedClientName] = useState(null);
  const [expandedSentKey, setExpandedSentKey] = useState(null);
  const [quotePricesMap, setQuotePricesMap] = useState({});
  const [profitMap, setProfitMap] = useState({});
  const [gstMap, setGstMap] = useState({});
  const [sendingClientName, setSendingClientName] = useState(null);
  const [editingSentAmounts, setEditingSentAmounts] = useState({});
  const [savingSentAmount, setSavingSentAmount] = useState(null);

  // Communication States
  const [showCommDrawer, setShowCommDrawer] = useState(false);
  const [selectedQuoteForComm, setSelectedQuoteForComm] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (showCommDrawer) {
      scrollToBottom();
    }
  }, [messages, showCommDrawer]);

  const fetchUnreadCounts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/communications/unread-counts?type=CLIENT`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const counts = {};
        data.forEach(item => {
          counts[item.quotation_id] = item.unread_count;
        });
        setUnreadCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const fetchMessages = async (quotationId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotations/communications?quotationId=${quotationId}&type=CLIENT`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        
        // Mark as read
        await fetch(`${API_BASE}/quotations/communications/mark-as-read`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ quotationId, type: 'CLIENT' })
        });
        fetchUnreadCounts();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleRefreshMessages = async () => {
    if (!selectedQuoteForComm || syncing) return;
    
    try {
      setSyncing(true);
      const token = localStorage.getItem('authToken');
      // Trigger sync
      await fetch(`${API_BASE}/quotations/communications/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Wait 3 seconds for sync to start processing
      setTimeout(() => {
        fetchMessages(selectedQuoteForComm.id);
        setSyncing(false);
      }, 3000);
    } catch (error) {
      console.error('Error syncing messages:', error);
      fetchMessages(selectedQuoteForComm.id);
      setSyncing(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedQuoteForComm) return;

    try {
      setSendingMsg(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${API_BASE}/quotations/communications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quotationId: selectedQuoteForComm.id,
          quotationType: 'CLIENT',
          message: newMessage,
          recipientEmail: selectedQuoteForComm.clientEmail,
          quoteNumber: `QRT-${String(selectedQuoteForComm.id).padStart(4, '0')}`
        })
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedQuoteForComm.id);
      } else {
        errorToast('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      errorToast('Error sending message');
    } finally {
      setSendingMsg(false);
    }
  };

  const openCommDrawer = (group) => {
    const firstQuote = group.quotes?.[0];
    
    setSelectedQuoteForComm({
      id: group.id,
      company_name: group.company_name,
      clientEmail: firstQuote?.email || ''
    });
    setMessages([]);
    setShowCommDrawer(true);
    fetchMessages(group.id);
  };

  const fetchApprovedOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/approved-drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch approved orders');
      const data = await response.json();
      
      const grouped = {};
      const initialPrices = {};
      const initialProfits = {};
      const initialGst = {};
      data.forEach(order => {
        const clientName = order.company_name || 'Unassigned';
        if (!grouped[clientName]) {
          grouped[clientName] = {
            company_name: clientName,
            company_id: order.company_id,
            contact_person: order.contact_person || '',
            email: order.email || '',
            phone: order.phone || '',
            address: order.address || '',
            created_at: order.created_at,
            orders: []
          };
          initialPrices[clientName] = {};
          initialProfits[clientName] = {};
          initialGst[clientName] = {};
        }
        const fgItems = (order.items || []).filter(item => 
          (item.item_group === 'FG' || item.item_type === 'FG' || (item.item_group || '').toLowerCase().includes('finished') || !item.item_group) && (item.status === 'REJECTED' || Number(item.bom_cost) >= 0)
        );
        order.items = fgItems;
        grouped[clientName].orders.push(order);
        
        if (order.items) {
          order.items.forEach(item => {
            const margin = Number(order.profit_margin) || 0;
            initialProfits[clientName][item.id] = margin;
            initialGst[clientName][item.id] = 18;

            if (item.bom_cost && Number(item.bom_cost) > 0) {
              const calculatedPrice = Number(item.bom_cost) * (1 + margin / 100);
              initialPrices[clientName][item.id] = calculatedPrice.toFixed(2);
            } else if (item.rate && Number(item.rate) > 0) {
              initialPrices[clientName][item.id] = item.rate;
            }
          });
        }
      });
      setGroupedByClient(grouped);
      setQuotePricesMap(prev => ({ ...prev, ...initialPrices }));
      setProfitMap(prev => ({ ...prev, ...initialProfits }));
      setGstMap(prev => ({ ...prev, ...initialGst }));
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch sent quotations');
      const data = await response.json();
      
      const grouped = {};
      data.forEach(quote => {
        const date = new Date(quote.created_at);
        const roundedTime = Math.floor(date.getTime() / 10000) * 10000;
        const key = `${quote.company_id}_${roundedTime}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            id: quote.id,
            uniqueKey: key,
            company_name: quote.company_name,
            company_id: quote.company_id,
            created_at: quote.created_at,
            status: 'Sent', 
            reply_pdf: quote.reply_pdf,
            total_amount: 0,
            received_amount: 0,
            quotes: []
          };
        } else {
          if (quote.id < grouped[key].id) {
            grouped[key].id = quote.id;
          }
          if (quote.reply_pdf) {
            grouped[key].reply_pdf = quote.reply_pdf;
          }
        }
        grouped[key].quotes.push(quote);
        if (quote.status !== 'REJECTED') {
          grouped[key].total_amount += parseFloat(quote.total_amount) || 0;
          grouped[key].received_amount += parseFloat(quote.received_amount) || 0;
        }
      });
      
      Object.values(grouped).forEach(group => {
        const hasRejected = group.quotes.some(q => (q.status || '').trim().toUpperCase() === 'REJECTED');
        const hasAccepted = group.quotes.some(q => (q.status || '').trim().toUpperCase() !== 'REJECTED');
        
        if (hasAccepted && hasRejected) {
          group.status = 'PARTIAL';
        } else if (hasRejected && !hasAccepted) {
          group.status = 'REJECTED';
        } else if (group.quotes.every(q => (q.status || '').trim().toUpperCase() === 'APPROVED')) {
          group.status = 'Approved';
        } else {
          group.status = 'Sent';
        }
      });
      
      setSentQuotations(Object.values(grouped));
    } catch (error) {
      console.error(error);
      errorToast(error.message || 'Failed to fetch sent quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();
    if (activeTab === 'pending') {
      fetchApprovedOrders();
    } else if (activeTab === 'sent') {
      fetchSentQuotations();
    } else if (activeTab === 'received') {
      fetchReceivedQuotations();
    }
  }, [activeTab]);

  const fetchReceivedQuotations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests?status=Approved,Approved ,Rejected,REJECTED,Accepted,ACCEPTED,Approval,APPROVAL,Completed,COMPLETED`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch received quotations');
      const data = await response.json();
      
      const grouped = {};
      data.forEach(quote => {
        const date = new Date(quote.created_at);
        const roundedTime = Math.floor(date.getTime() / 10000) * 10000;
        const key = `${quote.company_id}_${roundedTime}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            id: quote.id,
            uniqueKey: key,
            company_name: quote.company_name,
            company_id: quote.company_id,
            created_at: quote.created_at,
            status: quote.status,
            reply_pdf: quote.reply_pdf,
            total_amount: 0,
            received_amount: 0,
            quotes: []
          };
        } else {
          if (quote.id < grouped[key].id) {
            grouped[key].id = quote.id;
          }
          if (quote.status === 'Approved' || quote.status === 'Approval') {
            grouped[key].status = quote.status;
            if (quote.reply_pdf) grouped[key].reply_pdf = quote.reply_pdf;
          }
        }
        grouped[key].quotes.push(quote);
        grouped[key].total_amount += parseFloat(quote.total_amount) || 0;
        grouped[key].received_amount += parseFloat(quote.received_amount) || 0;
      });
      
      setReceivedQuotations(Object.values(grouped));
    } catch (error) {
      console.error(error);
      errorToast(error.message || 'Failed to fetch received quotations');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandClient = (clientName) => {
    if (expandedClientName === clientName) {
      setExpandedClientName(null);
    } else {
      setExpandedClientName(clientName);
    }
  };

  const handlePriceChange = (clientName, item, price) => {
    const rate = parseFloat(price) || 0;
    const bomCost = parseFloat(item.bom_cost) || 0;
    
    let profit = 0;
    if (bomCost > 0) {
      profit = ((rate / bomCost) - 1) * 100;
    }

    setQuotePricesMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: price
      }
    }));

    setProfitMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: profit.toFixed(2)
      }
    }));
  };

  const handleProfitChange = (clientName, item, profitVal) => {
    const profit = parseFloat(profitVal) || 0;
    const bomCost = parseFloat(item.bom_cost) || 0;
    const newRate = (bomCost * (1 + profit / 100)).toFixed(2);
    
    setProfitMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: profitVal
      }
    }));
    
    setQuotePricesMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [item.id]: newRate
      }
    }));
  };

  const handleGstChange = (clientName, itemId, gstVal) => {
    setGstMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [itemId]: gstVal
      }
    }));
  };

  const handleApproveQuote = async (group) => {
    const result = await Swal.fire({
      title: 'Approve Quotation',
      text: `Please upload the client's approval/reply PDF for QRT-${String(group.id).padStart(4, '0')}`,
      icon: 'info',
      input: 'file',
      inputAttributes: {
        'accept': 'application/pdf',
        'aria-label': 'Upload approval PDF'
      },
      showCancelButton: true,
      confirmButtonText: 'Upload & Approve',
      confirmButtonColor: '#10b981',
      showLoaderOnConfirm: true,
      preConfirm: (file) => {
        if (!file) {
          Swal.showValidationMessage('Please select a PDF file');
          return false;
        }
        return file;
      }
    });

    if (result.isConfirmed) {
      try {
        const file = result.value;
        const token = localStorage.getItem('authToken');
        const ids = group.quotes.map(q => q.id);
        
        const formData = new FormData();
        formData.append('reply_pdf', file);
        formData.append('ids', JSON.stringify(ids));

        const response = await fetch(`${API_BASE}/quotation-requests/batch-approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          successToast('Quotation approved successfully');
          if (activeTab === 'sent') {
            fetchSentQuotations();
          } else {
            fetchReceivedQuotations();
          }
        } else {
          const errorData = await response.json();
          errorToast(errorData.error || 'Failed to approve quotation');
        }
      } catch (error) {
        console.error('Error approving quotation:', error);
        errorToast('Error approving quotation');
      }
    }
  };

  const handleSentAmountChange = (key, value) => {
    setEditingSentAmounts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSentAmount = async (group) => {
    const newAmount = editingSentAmounts[group.uniqueKey];
    if (newAmount === undefined || newAmount === '') return;

    try {
      setSavingSentAmount(group.uniqueKey);
      const token = localStorage.getItem('authToken');
      
      const totalOriginal = group.total_amount;
      const newTotalInclGst = parseFloat(newAmount);
      const newTotalBase = newTotalInclGst / 1.18;
      
      const itemsToUpdate = group.quotes.map(q => {
        const originalItemTotal = parseFloat(q.total_amount) || 0;
        const itemQty = parseFloat(q.item_qty) || 1;
        
        let newItemTotal;
        if (totalOriginal > 0) {
          newItemTotal = (originalItemTotal / totalOriginal) * newTotalBase;
        } else {
          newItemTotal = newTotalBase / group.quotes.length;
        }
        
        return {
          id: q.id,
          rate: newItemTotal / itemQty,
          qty: itemQty,
          received_amount: newTotalInclGst / group.quotes.length
        };
      });

      const response = await fetch(`${API_BASE}/quotation-requests/batch-update-rates`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: itemsToUpdate })
      });

      if (response.ok) {
        successToast('Amount updated successfully');
        if (activeTab === 'sent') {
          fetchSentQuotations();
        } else {
          fetchReceivedQuotations();
        }
        setEditingSentAmounts(prev => {
          const next = { ...prev };
          delete next[group.uniqueKey];
          return next;
        });
      } else {
        errorToast('Failed to update amount');
      }
    } catch (error) {
      console.error('Error updating amount:', error);
      errorToast('Error updating amount');
    } finally {
      setSavingSentAmount(null);
    }
  };

  const calculateClientTotal = (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return 0;
    
    const prices = quotePricesMap[clientName] || {};
    const gsts = gstMap[clientName] || {};
    let total = 0;
    
    clientData.orders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          if (item.status !== 'REJECTED') {
            const price = parseFloat(prices[item.id]) || 0;
            const gst = parseFloat(gsts[item.id]) || 18;
            const qty = parseFloat(item.design_qty) || 0;
            total += price * qty * (1 + gst / 100);
          }
        });
      }
    });
    
    return total;
  };

  const handleSendQuote = async (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return;

    if (!clientData.email) {
      errorToast('Client email is required to send quotation');
      return;
    }

    const prices = quotePricesMap[clientName] || {};
    let allItems = [];
    
    clientData.orders.forEach(order => {
      if (order.items) {
        allItems = allItems.concat(order.items);
      }
    });

    const hasPrices = allItems.some(item => item.status !== 'REJECTED' && prices[item.id] && parseFloat(prices[item.id]) > 0);
    if (!hasPrices) {
      errorToast('Please enter quote prices for at least one item');
      return;
    }

    const itemsMissingDesignQty = allItems.filter(item => item.status !== 'REJECTED' && !item.design_qty);
    if (itemsMissingDesignQty.length > 0) {
      errorToast(`Design quantity missing for: ${itemsMissingDesignQty.map(i => i.drawing_no || i.item_code).join(', ')}. Quotation blocked.`);
      return;
    }

    const total = calculateClientTotal(clientName);
    
    const result = await Swal.fire({
      title: 'Create Quotation',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Client:</strong> ${clientData.company_name}</p>
          <p><strong>Items:</strong> ${allItems.length}</p>
          <p><strong>Total Amount:</strong> ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p style="color: #666; margin-top: 8px;">A professional quotation PDF will be generated for this client.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Create Quotation',
      confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
      try {
        setSendingClientName(clientName);
        const token = localStorage.getItem('authToken');

        const quotationData = {
          clientId: clientData.company_id,
          clientName: clientData.company_name,
          clientEmail: clientData.email,
          emailRequired: false,
          items: allItems.map(item => {
            const order = clientData.orders.find(o => o.items?.some(i => i.id === item.id));
            const profits = profitMap[clientName] || {};
            const gsts = gstMap[clientName] || {};
            
            return {
              orderId: order?.id,
              salesOrderItemId: item.id,
              drawing_no: item.drawing_no,
              description: item.description,
              quantity: item.design_qty,
              unit: item.unit,
              status: item.status,
              rejection_reason: item.rejection_reason,
              quotedPrice: parseFloat(prices[item.id]) || 0,
              profit_percentage: profits[item.id] || 0,
              gst_percentage: gsts[item.id] || 18
            };
          }),
          totalAmount: total,
          notes: `Drawing Numbers: ${allItems.map(i => i.drawing_no).join(', ')}`
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
          throw new Error(errorData.error || errorData.message || 'Failed to create quotation');
        }

        successToast('Quotation created successfully');
        setExpandedClientName(null);
        setQuotePricesMap(prev => ({
          ...prev,
          [clientName]: {}
        }));
        
        if (activeTab === 'pending') {
          fetchApprovedOrders();
        } else {
          fetchSentQuotations();
        }
      } catch (error) {
        errorToast(error.message);
      } finally {
        setSendingClientName(null);
      }
    }
  };

  const handleDownloadPDF = async (group) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quotation-requests/download-pdf/${group.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quotation_QRT-${String(group.id).padStart(4, '0')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('PDF error:', error);
      errorToast('Failed to load quotation PDF');
    }
  };

  const handleDeleteApprovedOrders = async (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return;

    const result = await Swal.fire({
      title: 'Delete BOM-Approved Orders',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p>Are you sure you want to delete all BOM-approved orders for <strong>${clientData.company_name}</strong>?</p>
          <p style="color: #dc2626; margin-top: 12px; font-weight: bold;">This action cannot be undone.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        let deleteCount = 0;

        for (const order of clientData.orders) {
          try {
            const response = await fetch(`${API_BASE}/sales-orders/${order.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (response.ok) {
              deleteCount++;
            }
          } catch (err) {
            console.error('Error deleting order:', err);
          }
        }

        successToast(`Deleted ${deleteCount} approved orders`);
        setExpandedClientName(null);
        setQuotePricesMap(prev => ({
          ...prev,
          [clientName]: {}
        }));
        fetchApprovedOrders();
      } catch (error) {
        errorToast(error.message);
      }
    }
  };

  const handleDeleteSentQuotation = async (group) => {
    const result = await Swal.fire({
      title: 'Delete Quotation',
      text: 'Are you sure you want to delete this quotation history? This will not affect the Sales Order.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const ids = group.quotes.map(q => q.id);
        
        const response = await fetch(`${API_BASE}/quotation-requests/batch-delete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids })
        });

        if (response.ok) {
          successToast('Quotation deleted successfully');
          if (activeTab === 'sent') {
            fetchSentQuotations();
          } else {
            fetchReceivedQuotations();
          }
        } else {
          errorToast('Failed to delete quotation');
        }
      } catch (error) {
        console.error('Delete error:', error);
        errorToast('Error deleting quotation');
      }
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Quotations</h1>
            <p className="text-sm text-slate-500 font-medium">Create and track quotations from BOM-approved orders</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <History size={16} /> Pending Approval
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'sent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Mail size={16} /> Sent Quotations
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'received' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Check size={16} /> Received Quotes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {activeTab === 'pending' && (
          <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 ">
                <CheckCircle className="w-5 h-5 text-indigo-600" />
                BOM-Approved Orders
              </h2>
              <button
                onClick={fetchApprovedOrders}
                disabled={loading}
                className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-slate-200 flex items-center gap-2 text-xs font-bold"
              >
                <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <div className="p-6">
              {Object.keys(groupedByClient).length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                  <p className="text-slate-500 font-bold">No BOM-approved orders found</p>
                  <p className="text-slate-400 text-sm">Orders must have an approved BOM before quotation</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Client Details</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Items</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                      {Object.entries(groupedByClient).map(([clientName, clientData]) => {
                        const totalItems = clientData.orders.reduce((sum, order) => {
                          return sum + (order.items?.length || 0);
                        }, 0);
                        const isExpanded = expandedClientName === clientName;
                        
                        return (
                          <React.Fragment key={clientName}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-900">{clientData.company_name}</span>
                                  <span className="text-xs text-slate-500">Added: {new Date(clientData.created_at).toLocaleDateString('en-IN')}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <Mail size={12} className="text-slate-400" />
                                    {clientData.email || '—'}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                    <User size={12} className="text-slate-400" />
                                    {clientData.contact_person || '—'}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                                  {totalItems} Items
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => toggleExpandClient(clientName)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                      isExpanded 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {isExpanded ? 'Hide' : 'View & Price'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteApprovedOrders(clientName)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                                    title="Remove from Pending"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan="4" className="px-6 py-4 bg-slate-50/50">
                                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                    <div className="px-5 py-3 border-b border-slate-50 bg-slate-50 flex items-center gap-2">
                                      <Package size={16} className="text-indigo-600" />
                                      <h3 className="text-sm font-bold text-slate-900">Approved Drawings & Pricing</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50/30">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Drawing</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">BOM Cost</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Profit %</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Unit Rate</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">GST %</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider pr-6">Quote Price</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {clientData.orders.flatMap((order) => 
                                            (order.items || []).map((item) => (
                                              <tr key={`${order.id}-${item.id}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                  <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-900">{item.drawing_no || 'N/A'}</span>
                                                    {item.status === 'REJECTED' && (
                                                      <span className="mt-1 px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[9px] font-bold w-fit">Rejected</span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-slate-600">{item.description || '—'}</td>
                                                <td className="px-4 py-3 text-center text-xs font-bold text-slate-900">{item.design_qty || '0'} {item.unit || 'Pcs'}</td>
                                                <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                                                  {item.bom_cost ? `₹${Number(item.bom_cost).toLocaleString('en-IN')}` : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <input
                                                    type="text"
                                                    value={profitMap[clientName]?.[item.id] || '0'}
                                                    onChange={(e) => handleProfitChange(clientName, item, e.target.value)}
                                                    className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                  />
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="relative group">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] group-focus-within:text-indigo-500 transition-colors">₹</span>
                                                    <input
                                                      type="text"
                                                      placeholder="0.00"
                                                      value={quotePricesMap[clientName]?.[item.id] || ''}
                                                      onChange={(e) => handlePriceChange(clientName, item, e.target.value)}
                                                      className="w-full pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <input
                                                    type="text"
                                                    value={gstMap[clientName]?.[item.id] || '18'}
                                                    onChange={(e) => handleGstChange(clientName, item.id, e.target.value)}
                                                    className="w-14 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                  />
                                                </td>
                                                <td className="px-4 py-3 text-right pr-6">
                                                  <span className="text-xs font-bold text-slate-900">
                                                    {formatCurrency((parseFloat(quotePricesMap[clientName]?.[item.id]) || 0) * (parseFloat(item.design_qty) || 0) * (1 + (parseFloat(gstMap[clientName]?.[item.id]) || 18) / 100))}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="p-6 bg-slate-50/80 border-t border-slate-100">
                                      {(() => {
                                        const clientOrders = groupedByClient[clientName].orders;
                                        let subTotal = 0;
                                        let totalProfit = 0;
                                        let totalTax = 0;

                                        clientOrders.forEach(order => {
                                          (order.items || []).forEach(item => {
                                            const unitRate = parseFloat(quotePricesMap[clientName]?.[item.id]) || 0;
                                            const qty = parseFloat(item.design_qty) || 0;
                                            const profitP = parseFloat(profitMap[clientName]?.[item.id]) || 0;
                                            const gstRate = parseFloat(gstMap[clientName]?.[item.id]) || 18;

                                            const lineTotal = unitRate * qty;
                                            subTotal += lineTotal;
                                            totalTax += lineTotal * (gstRate / 100);
                                            const basePrice = unitRate / (1 + profitP / 100);
                                            totalProfit += (unitRate - basePrice) * qty;
                                          });
                                        });

                                        return (
                                          <div className="flex flex-col items-end gap-2">
                                            <div className="space-y-1 w-72">
                                              <div className="flex justify-between text-xs font-medium">
                                                <span className="text-slate-500">Sub Total:</span>
                                                <span className="text-slate-900">{formatCurrency(subTotal)}</span>
                                              </div>
                                              <div className="flex justify-between text-xs font-bold text-indigo-600">
                                                <span>Est. Profit:</span>
                                                <span>{formatCurrency(totalProfit)}</span>
                                              </div>
                                              <div className="flex justify-between text-xs font-medium">
                                                <span className="text-slate-500">Tax (GST):</span>
                                                <span className="text-slate-900">{formatCurrency(totalTax)}</span>
                                              </div>
                                              <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                                                <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                                                <span className="text-xl font-black text-indigo-600">{formatCurrency(subTotal + totalTax)}</span>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleSendQuote(clientName)}
                                              disabled={sendingClientName === clientName || (subTotal + totalTax) === 0}
                                              className="mt-4 w-72 flex justify-center items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                                            >
                                              {sendingClientName === clientName ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                              ) : (
                                                <Save className="w-5 h-5" />
                                              )}
                                              {sendingClientName === clientName ? 'Creating Quotation...' : 'Create Quotation'}
                                            </button>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        {(activeTab === 'sent' || activeTab === 'received') && (
          <div className="space-y-6">
            {(activeTab === 'sent' ? sentQuotations : receivedQuotations).length === 0 ? (
              <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-slate-50 rounded-2xl mb-4">
                    <Mail className="w-12 h-12 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-bold text-lg">No {activeTab} quotations found</p>
                  <p className="text-slate-400 text-sm mt-1 font-medium">Quotations will appear here once created or received</p>
                </div>
              </Card>
            ) : (
              <Card className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {activeTab === 'sent' ? <Mail className="w-5 h-5 text-indigo-600" /> : <ClipboardList className="w-5 h-5 text-indigo-600" />}
                    {activeTab === 'sent' ? 'Sent Quotations History' : 'Received Quotations (Client Approved)'}
                  </h2>
                  <button
                    onClick={activeTab === 'sent' ? fetchSentQuotations : fetchReceivedQuotations}
                    disabled={loading}
                    className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-slate-200 flex items-center gap-2 text-xs font-bold"
                  >
                    <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quote ID</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Client Details</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Project / Items</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                      {(activeTab === 'sent' ? sentQuotations : receivedQuotations).map((group) => {
                        const key = group.uniqueKey;
                        const isExpanded = expandedSentKey === key;
                        
                        return (
                          <React.Fragment key={key}>
                            <tr className={`hover:bg-indigo-50/30 transition-all ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black border border-indigo-100">
                                  QRT-{String(group.id).padStart(4, '0')}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-900">{group.company_name}</span>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {new Date(group.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-bold text-slate-700">
                                    {group.quotes.length > 1 ? `${group.quotes.length} Drawings` : group.quotes[0]?.project_name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 w-fit">
                                    <span className="text-emerald-600 text-xs font-bold">₹</span>
                                    <input
                                      type="text"
                                      value={editingSentAmounts[key] !== undefined ? editingSentAmounts[key] : (group.received_amount > 0 ? group.received_amount : group.total_amount * 1.18).toFixed(2)}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                          handleSentAmountChange(key, val);
                                        }
                                      }}
                                      className="w-24 bg-transparent text-emerald-700 text-xs font-black focus:outline-none"
                                    />
                                    {editingSentAmounts[key] !== undefined && (
                                      <button
                                        onClick={() => saveSentAmount(group)}
                                        disabled={savingSentAmount === key}
                                        className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all shadow-sm active:scale-90"
                                      >
                                        {savingSentAmount === key ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1">Incl. GST (18%)</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <StatusBadge status={group.status} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {group.status === 'Sent' && (
                                    <button
                                      onClick={() => handleApproveQuote(group)}
                                      className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all active:scale-95 shadow-sm"
                                      title="Approve Quotation"
                                    >
                                      <CheckCircle size={18} />
                                    </button>
                                  )}
                                  {group.reply_pdf && (
                                    <a
                                      href={getFileUrl(group.reply_pdf)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                                      title="View Reply PDF"
                                    >
                                      <FileText size={18} />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => setExpandedSentKey(isExpanded ? null : key)}
                                    className={`p-2 rounded-xl transition-all active:scale-95 border ${
                                      isExpanded 
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                    title="View Drawings"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button
                                    onClick={() => openCommDrawer(group)}
                                    className="p-2 relative bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all active:scale-95"
                                    title="Chat with Client"
                                  >
                                    <MessageSquare size={18} />
                                    {unreadCounts[group.id] > 0 && (
                                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-bounce">
                                        {unreadCounts[group.id]}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDownloadPDF(group)}
                                    className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-all active:scale-95"
                                    title="Download PDF"
                                  >
                                    <Download size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSentQuotation(group)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                                    title="Delete"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan="6" className="px-6 py-4 bg-slate-50/50">
                                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                    <div className="px-5 py-3 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Package size={16} className="text-indigo-600" />
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Quotation Breakdown</h3>
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50/30">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Drawing</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unit Price</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider pr-6">Total (Excl. GST)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {group.quotes.map((quote) => (
                                            <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors">
                                              <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                  <span className="text-xs font-bold text-slate-900">{quote.drawing_no || 'N/A'}</span>
                                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">SO: {quote.sales_order_id}</span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-[11px] text-slate-600 font-medium">{quote.item_description || '—'}</td>
                                              <td className="px-4 py-3 text-center text-xs font-bold text-slate-900">{quote.item_qty || '0'} {quote.item_unit || 'Pcs'}</td>
                                              <td className="px-4 py-3 text-right text-xs font-bold text-slate-600">
                                                ₹{Number(quote.quoted_price || (quote.total_amount / (quote.item_qty || 1)) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                              </td>
                                              <td className="px-4 py-3 text-right pr-6">
                                                <span className="text-xs font-black text-slate-900">
                                                  ₹{Number(quote.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex justify-end">
                                      <div className="flex items-center gap-8">
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Sub Total</span>
                                          <span className="text-sm font-bold text-slate-700">{formatCurrency(group.total_amount)}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">GST (18%)</span>
                                          <span className="text-sm font-bold text-slate-700">{formatCurrency(group.total_amount * 0.18)}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Net Amount</span>
                                          <span className="text-xl font-black text-indigo-600 tracking-tight">
                                            {formatCurrency(group.received_amount > 0 ? group.received_amount : group.total_amount * 1.18)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Communication Modal */}
        {showCommDrawer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
              onClick={() => setShowCommDrawer(false)}
            />
            <Card className="relative bg-white shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300 rounded-[2rem] border-0">
              <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                      Communication Portal
                      {unreadCounts[selectedQuoteForComm?.id] > 0 && (
                        <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full uppercase">New Messages</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2 mt-0.5">
                      <span className="text-indigo-600 font-black">{selectedQuoteForComm?.company_name}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                      QRT-{String(selectedQuoteForComm?.id).padStart(4, '0')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleRefreshMessages}
                    disabled={syncing}
                    className="p-3 hover:bg-slate-50 rounded-2xl transition-all border border-slate-100 text-slate-500 hover:text-indigo-600 active:scale-95"
                  >
                    <RotateCw size={20} className={syncing ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setShowCommDrawer(false)}
                    className="p-3 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 text-slate-500 hover:text-rose-600 active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
                      <MessageSquare className="w-10 h-10 opacity-20" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-widest">No history found</p>
                      <p className="text-xs font-bold text-slate-400 mt-1">Start a conversation with the client below</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((msg, idx) => {
                      const isSystem = msg.sender_type === 'SYSTEM';
                      const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[idx-1].created_at).toDateString();
                      
                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center my-4">
                              <span className="px-4 py-1 bg-white border border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                                {new Date(msg.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isSystem ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] group`}>
                              <div className={`flex flex-col ${isSystem ? 'items-end' : 'items-start'}`}>
                                <div className={`px-5 py-3 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${
                                  isSystem 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                                }`}>
                                  {msg.message}
                                </div>
                                <div className={`flex items-center gap-2 mt-1.5 px-1 ${isSystem ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tight">
                                    {isSystem ? 'Our Team' : 'Client'}
                                  </span>
                                  {isSystem && msg.email_message_id && (
                                    <div className="flex items-center gap-1 ml-1 text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                      <CheckCheck size={10} />
                                      <span className="text-[8px] font-black uppercase">Email Sent</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                  <div className="relative group">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here..."
                      rows="3"
                      className="w-full p-4 pr-12 text-sm font-medium border border-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50 transition-all resize-none placeholder:text-slate-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <div className="absolute right-4 bottom-4 flex items-center gap-2">
                      <span className={`text-[10px] font-black transition-colors ${newMessage.trim() ? 'text-indigo-500' : 'text-slate-300'}`}>
                        {newMessage.length} chars
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Mail size={14} className="text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Client will receive via email</span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={sendingMsg || !newMessage.trim()}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:scale-95 shadow-xl shadow-indigo-100 flex items-center gap-3 active:scale-95 group"
                    >
                      {sendingMsg ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          SENDING...
                        </>
                      ) : (
                        <>
                          SEND MESSAGE
                          <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientQuotations;