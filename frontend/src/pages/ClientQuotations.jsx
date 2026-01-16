import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const ClientQuotations = () => {
  const [groupedByClient, setGroupedByClient] = useState({});
  const [loading, setLoading] = useState(false);
  const [expandedClientName, setExpandedClientName] = useState(null);
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
      console.log('Approved orders response:', data);
      if (data.length > 0) {
        console.log('First order sample:', data[0]);
        console.log('First order debug contacts:', data[0]._debug_contacts);
      }

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
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedOrders();
  }, []);

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
        [itemId]: parseFloat(price) || 0
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
          total += prices[item.id] || 0;
        });
      }
    });
    
    return total;
  };

  const handleSendQuote = async (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return;

    if (!clientData.email) {
      Swal.fire('Error', 'Client email is required to send quotation', 'error');
      return;
    }

    const prices = quotePricesMap[clientName] || {};
    let allItems = [];
    
    clientData.orders.forEach(order => {
      if (order.items) {
        allItems = allItems.concat(order.items);
      }
    });

    const hasPrices = allItems.some(item => prices[item.id] && prices[item.id] > 0);
    if (!hasPrices) {
      Swal.fire('Error', 'Please enter quote prices for at least one item', 'error');
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
          <p style="color: #666; margin-top: 8px;">The quotation will be sent via email for client approval.</p>
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
              quotedPrice: prices[item.id] || 0
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
          ? 'Quotation sent to client via email' 
          : 'Quotation created successfully (email pending)';
        
        Swal.fire('Success', successMessage, 'success');
        setExpandedClientName(null);
        setQuotePricesMap(prev => ({
          ...prev,
          [clientName]: {}
        }));
        fetchApprovedOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
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

        Swal.fire('Success', `Deleted ${deleteCount} approved orders`, 'success');
        setExpandedClientName(null);
        setQuotePricesMap(prev => ({
          ...prev,
          [clientName]: {}
        }));
        fetchApprovedOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Client Quotations</h1>
          <p className="text-slate-600 text-xs">Create quotations from design-approved drawings</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-2">
            <div className="flex justify-between items-center">
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Design-Approved Orders
              </h2>
              <button
                onClick={fetchApprovedOrders}
                disabled={loading}
                className="px-3 py-1.5 bg-white text-emerald-600 rounded text-xs font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-600 font-semibold text-sm">Loading approved orders...</p>
            </div>
          ) : Object.keys(groupedByClient).length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-slate-500 font-semibold">No design-approved orders found</p>
              <p className="text-slate-400 text-sm mt-1">Orders must be approved by Design Engineer first</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-slate-100">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Client Name</th>
                    <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Email</th>
                    <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Phone</th>
                    <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Date</th>
                    <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Items</th>
                    <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {Object.entries(groupedByClient).map(([clientName, clientData]) => {
                    const totalItems = clientData.orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);
                    return (
                      <React.Fragment key={clientName}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="p-2">
                            <div className="font-semibold text-slate-900 text-xs">{clientData.company_name}</div>
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
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                              {totalItems}
                            </span>
                          </td>
                          <td className="p-2 text-left">
                            <div className="flex gap-2 justify-left">
                              <button
                                onClick={() => toggleExpandClient(clientName)}
                                className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1"
                              >
                                {expandedClientName === clientName ? (
                                  <>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                    View
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteApprovedOrders(clientName)}
                                className="px-4 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition-colors inline-flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedClientName === clientName && (
                          <tr>
                            <td colSpan="6" className="px-0 py-0">
                              <div className="bg-slate-50 border-t border-b border-slate-200 ">
                                <div className="bg-white  border border-slate-200 overflow-hidden">
                                  <div className="bg-slate-100 p-2 border-b border-slate-200">
                                    <h3 className="font-bold text-slate-900 text-xs">Approved Drawings & Pricing</h3>
                                  </div>

                                  <table className="w-full divide-y divide-slate-100">
                                    <thead className="bg-white">
                                      <tr className="border-b border-slate-200">
                                        <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">#</th>
                                        <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Drawing</th>
                                        <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Description</th>
                                        <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Qty</th>
                                        <th className="p-2 text-left text-xs font-bold text-slate-700 uppercase">Unit</th>
                                        <th className="p-2text-left text-xs font-bold text-slate-700 uppercase">Quote Price</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {clientData.orders.flatMap((order, orderIdx) => 
                                        (order.items || []).map((item, itemIdx) => (
                                          <tr key={`${order.id}-${item.id}`} className="hover:bg-slate-50">
                                            <td className="p-2 text-xs text-slate-600 font-semibold">
                                              {clientData.orders.slice(0, orderIdx).reduce((sum, o) => sum + (o.items?.length || 0), 0) + itemIdx + 1}
                                            </td>
                                            <td className="p-2">
                                              <div className="font-semibold text-slate-900 text-xs text-sm">{item.drawing_no || 'N/A'}</div>
                                            </td>
                                            <td className="p-2 text-xs text-slate-600">{item.description || '—'}</td>
                                            <td className="p-2 text-left text-sm font-semibold text-slate-900 text-xs">{item.quantity}</td>
                                            <td className="p-2 text-xs text-slate-600">{item.unit || 'Pcs'}</td>
                                            <td className="p-2 text-right">
                                              <input
                                                type="number"
                                                placeholder="₹ 0.00"
                                                step="0.01"
                                                value={quotePricesMap[clientName]?.[item.id] || ''}
                                                onChange={(e) => handlePriceChange(clientName, item.id, e.target.value)}
                                                className="w-32 p-2 border border-slate-300 rounded text-right text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                              />
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>

                                  <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-between items-center">
                                    <div>
                                      <p className="text-xs text-slate-600 font-semibold">Total Quotation Value</p>
                                      <p className="text-2xl font-bold text-emerald-600">
                                        ₹{calculateClientTotal(clientName).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleSendQuote(clientName)}
                                      disabled={sendingClientName === clientName || calculateClientTotal(clientName) === 0}
                                      className="px-6 py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2 text-sm"
                                    >
                                      {sendingClientName === clientName ? (
                                        <>
                                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          Sending...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                          </svg>
                                          Send Quote to Client
                                        </>
                                      )}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientQuotations;
