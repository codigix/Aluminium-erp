import React, { useState, useEffect, useMemo } from 'react';
import { Card, DataTable, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const ClientQuotations = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'sent'
  const [groupedByClient, setGroupedByClient] = useState({});
  const [sentQuotations, setSentQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
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
      Swal.fire('Error', error.message, 'error');
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
      
      // Group by client and day to show batches
      const grouped = {};
      data.forEach(quote => {
        const key = quote.company_id;
        if (!grouped[key]) {
          grouped[key] = {
            id: quote.id,
            company_name: quote.company_name,
            company_id: quote.company_id,
            created_at: quote.created_at,
            status: quote.status,
            total_amount: 0,
            quotes: []
          };
        }
        grouped[key].quotes.push(quote);
        grouped[key].total_amount += parseFloat(quote.total_amount) || 0;
      });
      
      setSentQuotations(Object.values(grouped));
    } catch (error) {
      console.error(error);
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

  const pendingColumns = [
    {
      key: 'company_name',
      label: 'Client Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="text-slate-900 font-medium">{val}</div>
          {row.contact_person && (
            <div className="text-[10px] text-slate-500">{row.contact_person}</div>
          )}
        </div>
      )
    },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone' },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (val) => new Date(val).toLocaleDateString('en-IN')
    },
    {
      key: 'orders',
      label: 'Items',
      render: (orders) => (
        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold">
          {orders.reduce((sum, order) => sum + (order.items?.length || 0), 0)} Drawings
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleDeleteApprovedOrders(row.company_name)}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Approved Orders"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  const sentColumns = [
    {
      key: 'id',
      label: 'Quote ID',
      sortable: true,
      render: (val) => <span className="text-indigo-600 font-medium">QRT-{String(val).padStart(4, '0')}</span>
    },
    { key: 'company_name', label: 'Client', sortable: true },
    {
      key: 'quotes',
      label: 'Project / Details',
      render: (quotes) => quotes.length > 1 ? `${quotes.length} Drawings` : (quotes[0]?.project_name || '—')
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      sortable: true,
      render: (val) => (
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400">Incl. GST (18%)</span>
          <span className="text-emerald-600 font-bold">₹{(val * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (val) => new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    }
  ];

  const handlePriceChange = (clientName, itemId, price) => {
    setQuotePricesMap(prev => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [itemId]: price
      }
    }));
  };

  const pendingData = useMemo(() => Object.values(groupedByClient), [groupedByClient]);

  const renderPendingExpanded = (clientData) => {
    const clientName = clientData.company_name;
    const allItems = clientData.orders.flatMap(order => order.items || []);
    const total = calculateClientTotal(clientName);

    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approved Drawings & Pricing
          </h3>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Quotation Value</p>
            <p className="text-xl font-bold text-emerald-600">
              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] tracking-widest font-bold">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Drawing</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Quote Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {allItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.drawing_no || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                  <td className="px-4 py-3 text-slate-500">{item.unit || 'Pcs'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <span className="text-slate-400">₹</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={quotePricesMap[clientName]?.[item.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            handlePriceChange(clientName, item.id, val);
                          }
                        }}
                        className="w-24 p-1.5 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => handleSendQuote(clientName)}
            disabled={sendingClientName === clientName || total === 0}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-200 flex items-center gap-2 text-sm"
          >
            {sendingClientName === clientName ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Quote to Client
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderSentExpanded = (group) => (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-white p-3 border-b border-slate-200">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quotation Breakdown</h4>
      </div>
      <table className="w-full text-left text-[11px]">
        <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] tracking-widest font-bold">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Drawing</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2 text-right">Qty</th>
            <th className="px-4 py-2">Unit</th>
            <th className="px-4 py-2 text-right">Quote Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {group.quotes.map((q, idx) => (
            <tr key={q.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
              <td className="px-4 py-2 font-medium text-slate-900">{q.drawing_no || '—'}</td>
              <td className="px-4 py-2 text-slate-600">{q.item_description}</td>
              <td className="px-4 py-2 text-right font-medium">
                {q.item_qty !== null ? Number(q.item_qty).toFixed(3) : '—'}
              </td>
              <td className="px-4 py-2 text-slate-500">{q.item_unit || 'NOS'}</td>
              <td className="px-4 py-2 text-right text-emerald-600 font-bold">
                ₹{(q.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 text-[10px]">
          <tr>
            <td colSpan="5" className="px-4 py-2 text-right text-slate-500 font-medium">Sub Total:</td>
            <td className="px-4 py-2 text-right text-slate-900 font-bold">₹{group.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td colSpan="5" className="px-4 py-2 text-right text-slate-500 font-medium">GST (18%):</td>
            <td className="px-4 py-2 text-right text-slate-900 font-bold">₹{(group.total_amount * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr className="bg-emerald-50/50">
            <td colSpan="5" className="px-4 py-2 text-right text-emerald-700 font-bold uppercase tracking-wider">Grand Total:</td>
            <td className="px-4 py-2 text-right text-emerald-600 font-black text-xs">₹{(group.total_amount * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const calculateClientTotal = (clientName) => {
    const clientData = groupedByClient[clientName];
    if (!clientData) return 0;
    
    const prices = quotePricesMap[clientName] || {};
    let total = 0;
    
    clientData.orders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const price = parseFloat(prices[item.id]) || 0;
          total += price * (item.quantity || 1);
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

    const hasPrices = allItems.some(item => prices[item.id] && parseFloat(prices[item.id]) > 0);
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
        
        await Swal.fire('Success', successMessage, 'success');
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
    <div className="min-h-screen bg-slate-50/50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Client Quotations</h1>
            <p className="text-slate-500 text-xs font-medium">Create and track quotations from design-approved drawings</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            {[
              { id: 'pending', label: 'Pending Approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'emerald' },
              { id: 'sent', label: 'Sent History', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'blue' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-200` 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={activeTab === 'pending' ? pendingColumns : sentColumns}
          data={activeTab === 'pending' ? pendingData : sentQuotations}
          loading={loading}
          searchPlaceholder={`Search ${activeTab === 'pending' ? 'pending orders' : 'sent quotations'}...`}
          renderExpanded={activeTab === 'pending' ? renderPendingExpanded : renderSentExpanded}
          emptyMessage={activeTab === 'pending' ? 'No design-approved orders found' : 'No sent quotations found'}
          actions={
            <button
              onClick={activeTab === 'pending' ? fetchApprovedOrders : fetchSentQuotations}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors group"
              title="Refresh Data"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          }
        />
      </div>
    </div>
  );
};

export default ClientQuotations;
