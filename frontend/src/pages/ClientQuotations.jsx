import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const ClientQuotations = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'sent'
  const [groupedByClient, setGroupedByClient] = useState({});
  const [sentQuotations, setSentQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedClientName, setExpandedClientName] = useState(null);
  const [expandedSentKey, setExpandedSentKey] = useState(null);
  const [quotePricesMap, setQuotePricesMap] = useState({});
  const [sendingClientName, setSendingClientName] = useState(null);

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
        }
        grouped[clientName].orders.push(order);
      });
      setGroupedByClient(grouped);
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
            status: 'SENT', // Default status for group
            total_amount: 0,
            quotes: []
          };
        }
        grouped[key].quotes.push(quote);
        if (quote.status !== 'REJECTED') {
          grouped[key].total_amount += parseFloat(quote.total_amount) || 0;
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
        } else if (group.quotes.every(q => q.status === 'APPROVED')) {
          group.status = 'APPROVED';
        } else {
          group.status = 'SENT';
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
    if (activeTab === 'pending') {
      fetchApprovedOrders();
    } else {
      fetchSentQuotations();
    }
  }, [activeTab]);

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
            total += price * (item.quantity || 1);
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
              quantity: item.quantity,
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
      title: 'Delete Approved Orders',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p>Are you sure you want to delete all approved drawings for <strong>${clientData.company_name}</strong>?</p>
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
            <p className="text-slate-600 text-xs">Create and track quotations from design-approved drawings</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 rounded-lg text-xs  transition-all ${activeTab === 'pending' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Pending Approval
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-1.5 rounded-lg text-xs  transition-all ${activeTab === 'sent' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sent Quotations
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className={`bg-gradient-to-r ${activeTab === 'pending' ? 'from-emerald-600 to-teal-600' : 'from-blue-600 to-indigo-600'} p-2`}>
            <div className="flex justify-between items-center">
              <h2 className="text-xs  text-white flex items-center gap-2">
                {activeTab === 'pending' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Design-Approved Orders
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    Sent Quotations History
                  </>
                )}
              </h2>
              <button
                onClick={activeTab === 'pending' ? fetchApprovedOrders : fetchSentQuotations}
                disabled={loading}
                className="px-3 py-1.5 bg-white rounded text-xs  shadow-sm transition-colors disabled:opacity-50"
                style={{ color: activeTab === 'pending' ? '#059669' : '#4f46e5' }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="flex justify-center mb-3">
                <div className={`w-6 h-6 border-2 ${activeTab === 'pending' ? 'border-emerald-600' : 'border-indigo-600'} border-t-transparent rounded-full animate-spin`}></div>
              </div>
              <p className="text-slate-600  text-sm">Loading data...</p>
            </div>
          ) : activeTab === 'pending' ? (
            Object.keys(groupedByClient).length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-slate-500 ">No design-approved orders found</p>
                <p className="text-slate-400 text-sm mt-1">Orders must be approved by Design Engineer first</p>
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
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs ">
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
                                          <th className="p-2 text-left text-xs  text-slate-700 ">Quote Price</th>
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
                                              <td className="p-2 text-left text-sm text-slate-900 text-xs">{item.quantity}</td>
                                              <td className="p-2 text-xs text-slate-600">{item.unit || 'Pcs'}</td>
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
                                                    className="w-32 p-2 border border-slate-300 rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                  />
                                                )}
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
                                        className="px-6 py-2 bg-emerald-600 text-white rounded  hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2 text-sm"
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
            sentQuotations.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p className="text-slate-500 ">No sent quotations found</p>
                <p className="text-slate-400 text-sm mt-1">Quotations you send will appear here</p>
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
                    {sentQuotations.map((group) => {
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
                              <div className="flex flex-col">
                                <span className="text-slate-400 text-[10px] font-normal">Incl. GST (18%)</span>
                                <span>₹{(group.total_amount * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </td>
                            <td className="p-2 text-xs text-slate-500">{new Date(group.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px]  ${
                                group.status === 'SENT' ? 'bg-blue-100 text-blue-700' : 
                                group.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 
                                group.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                group.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {group.status}
                              </span>
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() => setExpandedSentKey(expandedSentKey === key ? null : key)}
                                className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px]  hover:bg-indigo-700 transition-colors"
                              >
                                {expandedSentKey === key ? 'Hide' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {expandedSentKey === key && (
                            <tr>
                              <td colSpan="7" className="px-0 py-0">
                                <div className="bg-slate-50 p-3 border-t border-b border-slate-200">
                                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
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
      </div>
    </div>
  );
};

export default ClientQuotations;
