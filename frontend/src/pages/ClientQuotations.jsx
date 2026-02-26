import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { MessageSquare, Send, X, User, ShieldCheck, RotateCw, Save, Check, FileText, CheckCircle, Mail, ClipboardList, Eye, Trash2, Loader2 } from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

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
    if (!selectedQuoteForComm) return;
    
    try {
      const token = localStorage.getItem('authToken');
      // Trigger sync
      await fetch(`${API_BASE}/quotations/communications/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Wait 1 second for sync to start processing
      setTimeout(() => {
        fetchMessages(selectedQuoteForComm.id);
      }, 1000);
    } catch (error) {
      console.error('Error syncing messages:', error);
      fetchMessages(selectedQuoteForComm.id);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedQuoteForComm) return;

    try {
      setSendingMsg(true);
      const token = localStorage.getItem('authToken');
      
      // Find client email from groupedByClient or sentQuotations
      const group = sentQuotations.find(g => g.id === selectedQuoteForComm.id);
      const firstQuote = group?.quotes?.[0];
      
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
          recipientEmail: selectedQuoteForComm.clientEmail || firstQuote?.email,
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
    // We need the client email, but it's not in the group object directly from fetchSentQuotations
    // Let's get it from the first quote in the group
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
        }
        const fgItems = (order.items || []).filter(item => 
          (item.item_group === 'FG' || item.item_type === 'FG' || !item.item_group) && (item.status === 'REJECTED' || Number(item.bom_cost) >= 0)
        );
        order.items = fgItems;
        grouped[clientName].orders.push(order);
        
        // Initialize prices from items
        if (order.items) {
          order.items.forEach(item => {
            if (item.bom_cost && Number(item.bom_cost) > 0) {
              const margin = Number(order.profit_margin) || 0;
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
      
      // Group by client and timestamp (rounded to 10s to catch batches)
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
            status: 'Sent ', // Default status for group
            reply_pdf: quote.reply_pdf,
            total_amount: 0,
            received_amount: 0,
            quotes: []
          };
        } else {
          // Use the smallest ID as the representative ID for the group
          // This ensures consistency with the QRT number sent in emails
          if (quote.id < grouped[key].id) {
            grouped[key].id = quote.id;
          }
          // Ensure reply_pdf is captured if any quote in the group has it
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
      
      // Post-process groups to determine status
      Object.values(grouped).forEach(group => {
        const hasRejected = group.quotes.some(q => q.status === 'REJECTED');
        const hasAccepted = group.quotes.some(q => q.status !== 'REJECTED');
        
        if (hasAccepted && hasRejected) {
          group.status = 'PARTIAL';
        } else if (hasRejected && !hasAccepted) {
          group.status = 'REJECTED';
        } else if (group.quotes.every(q => q.status === 'Approved ')) {
          group.status = 'Approved ';
        } else {
          group.status = 'Sent ';
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
      const response = await fetch(`${API_BASE}/quotation-requests?status=Approved,Rejected,Accepted,Approval,Completed`, {
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
          // Use the smallest ID as the representative ID for the group
          if (quote.id < grouped[key].id) {
            grouped[key].id = quote.id;
          }
          // If any quote in group is approved, prefer that status for the group view
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

  const handlePriceChange = (clientName, itemId, price) => {
    setQuotePricesMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [itemId]: price
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
            // Content-Type is set automatically for FormData
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
      
      // Distribute proportionally
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
    let total = 0;
    
    clientData.orders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          if (item.status !== 'REJECTED') {
            const price = parseFloat(prices[item.id]) || 0;
            total += price * (parseFloat(item.design_qty) || 0);
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
        // Include all items, but we'll mark their status
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
      title: 'Send Quotation',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Client:</strong> ${clientData.company_name}</p>
          <p><strong>Email:</strong> ${clientData.email || 'N/A'}</p>
          <p><strong>Items:</strong> ${allItems.length}</p>
          <p><strong>Total Amount:</strong> ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p style="color: #666; margin-top: 8px;">The quotation will be sent via email with a professional PDF attachment.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Send Quotation',
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
          items: allItems.map(item => {
            const order = clientData.orders.find(o => o.items?.some(i => i.id === item.id));
            return {
              orderId: order?.id,
              salesOrderItemId: item.id,
              drawing_no: item.drawing_no,
              description: item.description,
              quantity: item.design_qty,
              unit: item.unit,
              status: item.status,
              rejection_reason: item.rejection_reason,
              quotedPrice: parseFloat(prices[item.id]) || 0
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
          throw new Error(errorData.error || errorData.message || 'Failed to send quotation');
        }

        const responseData = await response.json();
        const successMessage = responseData.emailSent 
          ? 'Quotation sent to client via email with PDF attachment' 
          : 'Quotation created successfully (email pending)';
        
        successToast(successMessage);
        setExpandedClientName(null);
        setQuotePricesMap(prev => ({
          ...prev,
          [clientName]: {}
        }));
        
        // Refresh appropriate tab
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-xl text-slate-900 mb-1">Client Quotations</h1>
            <p className="text-slate-600 text-xs">Create and track quotations from BOM-approved orders</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 rounded  text-xs  transition-all ${activeTab === 'pending' ? 'bg-white text-emerald-600  ' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Pending Approval
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-1.5 rounded  text-xs  transition-all ${activeTab === 'sent' ? 'bg-white text-blue-600  ' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sent Quotations
            </button>
            <button
              onClick={() => setActiveTab('received')}
              className={`px-4 py-1.5 rounded  text-xs  transition-all ${activeTab === 'received' ? 'bg-white text-purple-600  ' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Received Quotes
            </button>
          </div>
        </div>

        <div className="bg-white rounded    border border-slate-200 overflow-hidden">
          <div className={`bg-gradient-to-r ${
            activeTab === 'pending' ? 'from-emerald-600 to-teal-600' : 
            activeTab === 'sent' ? 'from-blue-600 to-indigo-600' :
            'from-purple-600 to-indigo-600'
          } p-2`}>
            <div className="flex justify-between items-center">
              <h2 className="text-xs  text-white flex items-center gap-2 ">
                {activeTab === 'pending' ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    BOM-Approved Orders
                  </>
                ) : activeTab === 'sent' ? (
                  <>
                    <Mail className="w-5 h-5" />
                    Sent Quotations History
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-5 h-5" />
                    Received Quotations (Client Approved)
                  </>
                )}
              </h2>
              <button
                onClick={activeTab === 'pending' ? fetchApprovedOrders : activeTab === 'sent' ? fetchSentQuotations : fetchReceivedQuotations}
                disabled={loading}
                className="p-2 .5 bg-white rounded text-xs    transition-colors disabled:opacity-50"
                style={{ color: activeTab === 'pending' ? '#059669' : activeTab === 'sent' ? '#4f46e5' : '#7c3aed' }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="flex justify-center mb-3">
                <Loader2 className={`w-6 h-6 ${activeTab === 'pending' ? 'text-emerald-600' : 'text-indigo-600'} animate-spin`} />
              </div>
              <p className="text-slate-600  text-sm">Loading data...</p>
            </div>
          ) : activeTab === 'pending' ? (
            Object.keys(groupedByClient).length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 ">No BOM-approved orders found</p>
                <p className="text-slate-400 text-sm mt-1">Orders must have an approved BOM before quotation</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-100">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Client Name</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Email</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Phone</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Date</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Items</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {Object.entries(groupedByClient).map(([clientName, clientData]) => {
                      const totalItems = clientData.orders.reduce((sum, order) => {
                        return sum + (order.items?.length || 0);
                      }, 0);
                      return (
                        <React.Fragment key={clientName}>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="p-2">
                              <div className="text-slate-900 text-xs">{clientData.company_name}</div>
                              {clientData.contact_person && (
                                <div className="text-xs text-slate-600 mt-0.5">{clientData.contact_person}</div>
                              )}
                            </td>
                            <td className="p-2">
                              <div className="text-sm text-slate-600">{clientData.email || '—'}</div>
                            </td>
                            <td className="p-2">
                              <div className="text-sm text-slate-600">{clientData.phone || '—'}</div>
                            </td>
                            <td className="p-2">
                              <div className="text-sm text-slate-600">
                                {new Date(clientData.created_at).toLocaleDateString('en-IN')}
                              </div>
                            </td>
                            <td className="p-2 text-left">
                              <span className="p-2  bg-emerald-100 text-emerald-700 rounded  text-xs ">
                                {totalItems}
                              </span>
                            </td>
                            <td className="p-2 text-left">
                              <div className="flex gap-2 justify-left">
                                <button
                                  onClick={() => toggleExpandClient(clientName)}
                                  className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs  hover:bg-emerald-700 transition-colors inline-flex items-center gap-1"
                                >
                                  {expandedClientName === clientName ? 'Hide' : 'View'}
                                </button>
                                <button
                                  onClick={() => handleDeleteApprovedOrders(clientName)}
                                  className="px-4 py-1.5 bg-red-600 text-white rounded text-xs  hover:bg-red-700 transition-colors inline-flex items-center gap-1"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {expandedClientName === clientName && (
                            <tr>
                              <td colSpan="6" className="px-0 py-0">
                                <div className="bg-slate-50 border-t border-b border-slate-200">
                                  <div className="bg-white border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-100 p-2 border-b border-slate-200">
                                      <h3 className="text-slate-900 text-xs">Approved Drawings & Pricing</h3>
                                    </div>
                                    <table className="w-full divide-y divide-slate-100">
                                      <thead className="bg-white">
                                        <tr className="border-b border-slate-200">
                                          <th className="p-2 text-left text-xs  text-slate-700 ">#</th>
                                          <th className="p-2 text-left text-xs  text-slate-700 ">Drawing</th>
                                          <th className="p-2 text-left text-xs  text-slate-700 ">Description</th>
                                          <th className="p-2 text-left text-xs  text-slate-700 ">Qty</th>
                                          <th className="p-2 text-left text-xs  text-slate-700 ">Unit</th>
                                          <th className="p-2 text-left text-xs  text-slate-700 ">BOM Cost</th>
                                          <th className="p-2 text-left text-xs  text-slate-700 ">Unit Rate (₹)</th>
                                          <th className="p-2 text-right text-xs  text-slate-700 pr-4">Quote Price (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {clientData.orders.flatMap((order, orderIdx) => 
                                          (order.items || []).map((item, itemIdx) => (
                                            <tr key={`${order.id}-${item.id}`} className="hover:bg-slate-50">
                                              <td className="p-2 text-xs text-slate-600 ">
                                                {clientData.orders.slice(0, orderIdx).reduce((sum, o) => sum + (o.items?.length || 0), 0) + itemIdx + 1}
                                              </td>
                                              <td className="p-2">
                                                <div className="flex flex-col gap-1 items-start">
                                                  <div className="text-slate-900 text-xs">{item.drawing_no || 'N/A'}</div>
                                                  {item.status === 'REJECTED' && (
                                                    <div className="flex flex-col gap-1">
                                                      <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[8px]   w-fit animate-pulse">Rejected</span>
                                                      {item.rejection_reason && (
                                                        <span className="text-[9px] text-red-600 italic leading-tight">
                                                          Reason: {item.rejection_reason}
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}
                                                  {order.rejection_reason && order.status === 'DESIGN_QUERY' && (
                                                    <div className="text-[9px] text-amber-600 italic mt-1">
                                                      Note: {order.rejection_reason}
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="p-2 text-xs text-slate-600">{item.description || '—'}</td>
                                              <td className="p-2 text-left text-sm text-slate-900 text-xs">{item.design_qty || <span className="text-red-500 ">MISSING QTY</span>}</td>
                                              <td className="p-2 text-xs text-slate-600">{item.unit || 'Pcs'}</td>
                                              <td className="p-2 text-xs text-slate-600">
                                                {item.bom_cost ? `₹${Number(item.bom_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                              </td>
                                              <td className="p-2 text-right">
                                                {item.status === 'REJECTED' ? (
                                                  <span className="text-red-600  text-[10px]  pr-4">Rejected</span>
                                                ) : (
                                                  <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="₹ 0.00"
                                                    value={quotePricesMap[clientName]?.[item.id] || ''}
                                                    onChange={(e) => {
                                                      const val = e.target.value;
                                                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                        handlePriceChange(clientName, item.id, val);
                                                      }
                                                    }}
                                                    className="w-24 p-2 border border-slate-300 rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                  />
                                                )}
                                              </td>
                                              <td className="p-2 text-right text-xs  text-slate-900 pr-4">
                                                ₹{((parseFloat(quotePricesMap[clientName]?.[item.id]) || 0) * (parseFloat(item.design_qty) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                    <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-between items-center">
                                      <div>
                                        <p className="text-xs text-slate-600 ">Total Quotation Value</p>
                                        <p className="text-2xl  text-emerald-600">
                                          ₹{calculateClientTotal(clientName).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleSendQuote(clientName)}
                                        disabled={sendingClientName === clientName || calculateClientTotal(clientName) === 0}
                                        className="p-2 bg-emerald-600 text-white rounded  hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2  text-sm"
                                      >
                                        {sendingClientName === clientName ? 'Sending...' : 'Send Quote to Client'}
                                      </button>
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
            )
          ) : (
            (activeTab === 'sent' ? sentQuotations : receivedQuotations).length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 ">No {activeTab} quotations found</p>
                <p className="text-slate-400 text-sm mt-1">Quotations will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-100">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Quote ID</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Client</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Project / Details</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Total Amount</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Date</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Status</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {(activeTab === 'sent' ? sentQuotations : receivedQuotations).map((group) => {
                      const key = group.uniqueKey;
                      return (
                        <React.Fragment key={key}>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 text-xs  text-indigo-600">QRT-{String(group.id).padStart(4, '0')}</td>
                            <td className="p-2">
                              <div className="text-slate-900 text-xs">{group.company_name}</div>
                            </td>
                            <td className="p-2 text-xs text-slate-600">
                              {group.quotes.length > 1 ? `${group.quotes.length} Drawings` : group.quotes[0]?.project_name}
                            </td>
                            <td className="p-2 text-xs  text-emerald-600">
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-400 text-[10px] font-normal">Incl. GST (18%)</span>
                                <div className="flex items-center gap-1">
                                  {(activeTab === 'received' || activeTab === 'sent') ? (
                                    <>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600">₹</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={editingSentAmounts[key] !== undefined ? editingSentAmounts[key] : (group.received_amount > 0 ? group.received_amount : group.total_amount * 1.18).toFixed(2)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                              handleSentAmountChange(key, val);
                                            }
                                          }}
                                          className="w-24 pl-5 pr-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/30"
                                        />
                                      </div>
                                      {editingSentAmounts[key] !== undefined && (
                                        <button
                                          onClick={() => saveSentAmount(group)}
                                          disabled={savingSentAmount === key}
                                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                          title="Save Amount"
                                        >
                                          {savingSentAmount === key ? (
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded  animate-spin" />
                                          ) : (
                                            <Save className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <div className="p-2  bg-emerald-50 text-emerald-700 rounded  text-[11px]  border border-emerald-100">
                                      ₹{(group.received_amount > 0 ? group.received_amount : group.total_amount * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-2 text-xs text-slate-500">{new Date(group.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="p-2">
                              <span className={`p-1 rounded  text-xs  ${
                                group.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 
                                group.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 
                                group.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                (group.status === 'Approved' || group.status === 'Approval') ? 'bg-emerald-100 text-emerald-700' : 
                                group.status === 'Completed' ? 'bg-indigo-100 text-indigo-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {group.status === 'Approval' ? 'Approved' : group.status}
                              </span>
                            </td>
                            <td className="p-2">
                              <div className="flex gap-2 items-center">
                                {group.reply_pdf && (
                                  <a
                                    href={getFileUrl(group.reply_pdf)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded  transition-all"
                                    title="View Reply PDF"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </a>
                                )}
                                {(activeTab === 'received' || activeTab === 'sent') && !['Approved ', 'APPROVAL', 'COMPLETED'].includes(group.status) && !group.reply_pdf && (
                                  <button
                                    onClick={() => handleApproveQuote(group)}
                                    className="p-2  bg-emerald-600 text-white rounded text-[10px]  hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                    title="Approve for PO"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    Approve
                                  </button>
                                )}
                                <button
                                  onClick={() => setExpandedSentKey(expandedSentKey === key ? null : key)}
                                  className="p-2  bg-indigo-600 text-white rounded text-[10px]  hover:bg-indigo-700 transition-colors"
                                >
                                  {expandedSentKey === key ? 'Hide' : 'View'}
                                </button>
                                <button
                                  onClick={() => openCommDrawer(group)}
                                  className="relative p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded  transition-all"
                                  title="Communication"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  {unreadCounts[group.id] > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded  border border-white"></span>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedSentKey === key && (
                            <tr>
                              <td colSpan="7" className="px-0 py-0">
                                <div className="bg-slate-50 p-3 border-t border-b border-slate-200">
                                  <div className="bg-white border border-slate-200 rounded  overflow-hidden  ">
                                    <div className="bg-slate-100 p-2 .5 border-b border-slate-200">
                                      <h4 className="text-[10px]  text-slate-700 ">Quotation Breakdown</h4>
                                    </div>
                                    <table className="w-full divide-y divide-slate-100">
                                      <thead className="bg-white">
                                        <tr className="border-b border-slate-200">
                                          <th className="p-2 text-left text-[10px]  text-slate-700 ">#</th>
                                          <th className="p-2 text-left text-[10px]  text-slate-700 ">Drawing</th>
                                          <th className="p-2 text-left text-[10px]  text-slate-700 ">Description</th>
                                          <th className="p-2 text-left text-[10px]  text-slate-700 ">Qty</th>
                                          <th className="p-2 text-left text-[10px]  text-slate-700 ">Unit</th>
                                          <th className="p-2 text-right text-[10px]  text-slate-700 ">Quote Price</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {group.quotes.map((q, idx) => (
                                          <tr key={q.id} className={`hover:bg-slate-50 ${q.status === 'REJECTED' ? 'bg-red-50/50' : ''}`}>
                                            <td className="p-2 text-[10px] text-slate-600 ">{idx + 1}</td>
                                            <td className="p-2">
                                              <div className="flex flex-col gap-1">
                                                <div className="text-slate-900 text-xs font-medium">{q.drawing_no || '—'}</div>
                                                {q.status === 'REJECTED' && (
                                                  <div className="flex flex-col gap-0.5">
                                                    <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[8px]   w-fit animate-pulse">Rejected</span>
                                                    {q.rejection_reason && (
                                                      <span className="text-[9px] text-red-600 italic leading-tight">
                                                        Reason: {q.rejection_reason}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                            <td className="p-2 text-xs text-slate-600">{q.item_description}</td>
                                            {q.status === 'REJECTED' ? (
                                              <td colSpan={3} className="p-2 text-right">
                                                <span className="text-red-600  text-[10px]  pr-4">Rejected – No Financials</span>
                                              </td>
                                            ) : (
                                              <>
                                                <td className="p-2 text-left text-xs  text-slate-900">
                                                  {q.item_qty !== null ? Number(q.item_qty).toFixed(3) : '—'}
                                                </td>
                                                <td className="p-2 text-xs text-slate-600">{q.item_unit || 'NOS'}</td>
                                                <td className="p-2 text-right text-xs  text-emerald-600">₹{(q.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                              </>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-slate-50">
                                        <tr>
                                          <td colSpan="5" className="p-2 text-right text-xs  text-slate-700">Sub Total:</td>
                                          <td className="p-2 text-right text-xs text-slate-900">₹{group.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr>
                                          <td colSpan="5" className="p-2 text-right text-xs  text-slate-700">GST (18%):</td>
                                          <td className="p-2 text-right text-xs text-slate-900">₹{(group.total_amount * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr className="bg-emerald-50">
                                          <td colSpan="5" className="p-2 text-right text-xs  text-emerald-700 ">Grand Total (Incl. GST):</td>
                                          <td className="p-2 text-right text-xs  text-emerald-600 text-sm">₹{(group.total_amount * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
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
            )
          )}
        </div>

        {/* Communication Drawer */}
      {/* Communication Modal */}
      {showCommDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowCommDrawer(false)}
          />
          <div className="relative bg-white rounded  shadow-2xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm  text-slate-900 flex items-center gap-2 ">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  Communication History
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {selectedQuoteForComm?.company_name} (QRT-{String(selectedQuoteForComm?.id).padStart(4, '0')})
                </p>
              </div>
              <div className="flex items-center gap-2 ">
                <button 
                  onClick={handleRefreshMessages}
                  className="p-1.5 hover:bg-slate-200 rounded  transition-colors text-slate-500 hover:text-blue-600"
                  title="Refresh messages"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowCommDrawer(false)}
                  className="p-1.5 hover:bg-slate-200 rounded  transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <div className="p-4 bg-white rounded    border border-slate-100">
                    <MessageSquare className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-xs font-medium">No messages found for this quotation</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'SYSTEM' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded  p-2  text-xs   ${
                      msg.sender_type === 'SYSTEM' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                      <div className={`text-[9px] mt-2 flex items-center gap-1.5 ${msg.sender_type === 'SYSTEM' ? 'text-blue-100' : 'text-slate-400'}`}>
                        {msg.sender_type === 'SYSTEM' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        {new Date(msg.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        {msg.sender_type === 'SYSTEM' && msg.email_message_id && (
                          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded ">✓ Sent via Email</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <form onSubmit={handleSendMessage} className="relative flex gap-3 items-end">
                <div className="flex-1 relative">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message to the client..."
                    rows="3"
                    className="w-full p-3 pr-10 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-slate-50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingMsg || !newMessage.trim()}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 flex-shrink-0"
                >
                  {sendingMsg ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-slate-100" />
                <p className="text-[9px] text-slate-400 font-medium  ">
                  Email will be sent to {selectedQuoteForComm?.clientEmail}
                </p>
                <div className="h-px w-8 bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

export default ClientQuotations;

