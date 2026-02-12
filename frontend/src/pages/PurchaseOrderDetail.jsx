import React from 'react';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const PurchaseOrderDetail = ({ po, onBack }) => {
  if (!po) return null;

  const steps = [
    { label: 'Draft', status: ['DRAFT'], icon: (color) => (
      <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { label: 'Submitted', status: ['SUBMITTED', 'ORDERED', 'SENT'], icon: (color) => (
      <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    )},
    { label: 'Goods Arrival', status: ['RECEIVED', 'ACKNOWLEDGED'], icon: (color) => (
      <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    )},
    { label: 'Fulfilled', status: ['COMPLETED', 'CLOSED'], icon: (color) => (
      <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
  ];

  const currentStatus = po.status?.toUpperCase() || 'DRAFT';
  const getStepIndex = (status) => {
    if (['COMPLETED', 'CLOSED'].includes(status)) return 3;
    if (['RECEIVED', 'ACKNOWLEDGED'].includes(status)) return 2;
    if (['SUBMITTED', 'ORDERED', 'SENT'].includes(status)) return 1;
    return 0;
  };

  const activeStepIndex = getStepIndex(currentStatus);
  const filteredItems = (po.items || []).filter(item => {
    const type = (item.material_type || '').toUpperCase();
    return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
  });

  const subtotal = filteredItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0;
  const totalTax = filteredItems.reduce((sum, item) => sum + (parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0)), 0) || 0;
  const grandTotal = po.total_amount || (subtotal + totalTax);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all shadow-sm border border-blue-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Buying</span>
              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              <span>Purchase Orders</span>
              <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              <span className="text-blue-600">{po.po_number}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{po.po_number}</h1>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black shadow-sm">
                <div className={`w-2 h-2 rounded-full ${activeStepIndex === 3 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <span className="text-slate-600 uppercase">{po.status?.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2.5 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          </button>
          <button className="p-2.5 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm">
        <div className="relative flex justify-between">
          <div className="absolute top-6 left-0 w-full h-0.5 bg-slate-50" />
          <div 
            className="absolute top-6 left-0 h-0.5 bg-emerald-500 transition-all duration-1000" 
            style={{ width: `${(activeStepIndex / (steps.length - 1)) * 100}%` }}
          />
          
          {steps.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isActive = idx === activeStepIndex;
            const isFinished = activeStepIndex === steps.length - 1 && idx === steps.length - 1;
            
            return (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${isCompleted || isFinished ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 text-slate-300'}`}>
                  {step.icon(isCompleted || isFinished || isActive ? 'text-white' : 'text-slate-300')}
                </div>
                <div className="text-center">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isCompleted || isFinished || isActive ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 columns */}
        <div className="lg:col-span-3 space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-4 -right-4 text-slate-50 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Supplier</p>
              <h3 className="text-xl font-black text-slate-800 mb-2 truncate">{po.vendor_name}</h3>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Ship to Main Warehouse
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-4 -right-4 text-slate-50 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Total Value</p>
              <h3 className="text-2xl font-black text-slate-800 mb-2">{formatCurrency(po.total_amount, po.currency)}</h3>
              <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                INCL. ALL TAXES
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm relative overflow-hidden">
              <div className="absolute -top-4 -right-4 text-slate-50 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Expected By</p>
              <h3 className="text-xl font-black text-slate-800 mb-2">{formatDate(po.expected_delivery_date)}</h3>
              {po.expected_delivery_date && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border ${
                  new Date(po.expected_delivery_date) < new Date() 
                  ? 'bg-rose-50 text-rose-600 border-rose-100' 
                  : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {Math.ceil((new Date(po.expected_delivery_date) - new Date()) / (1000 * 60 * 60 * 24))} Days {new Date(po.expected_delivery_date) < new Date() ? 'Overdue' : 'Left'}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Shipping Details</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-start text-xs">
                  <span className="text-slate-400 font-medium">Address</span>
                  <span className="text-slate-800 font-bold text-right max-w-[200px]">{po.shipping_address || 'Gokul Nagar, Katraj, Pune - 411048'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Incoterm</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase border border-blue-100">{po.incoterm || 'EXW'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Shipping Rule</span>
                  <span className="text-slate-800 font-bold">{po.shipping_rule || 'Standard'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Payment & Others</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Tax Category</span>
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded text-[10px] font-black uppercase border border-slate-200">{po.tax_category || 'GST'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Currency</span>
                  <span className="text-slate-800 font-bold uppercase tracking-wider">{po.currency || 'INR'}</span>
                </div>
                <div className="flex justify-between items-start text-xs">
                  <span className="text-slate-400 font-medium">Notes</span>
                  <span className="text-slate-400 font-bold italic text-right max-w-[200px]">{po.notes || 'No notes added'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Items List</h4>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{filteredItems.length} Items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Design Qty</th>
                    {/* Hiding Received column as requested */}
                    {/* <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Received</th> */}
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Rate</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map((item, idx) => {
                    const received = parseFloat(item.accepted_quantity) || 0;
                    const total = parseFloat(item.quantity) || 1;
                    const percent = Math.min(100, Math.round((received / total) * 100));
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-slate-800">{item.material_name || item.description || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.item_code}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-black text-slate-800">{Number(item.design_qty || item.quantity || 0).toFixed(3)}</span>
                          <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">{item.unit}</span>
                        </td>
                        {/* Hiding Received column as requested */}
                        {/* <td className="px-6 py-4">
                          <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                            <div className="flex justify-between w-full text-[9px] font-black">
                              <span className="text-blue-600">{received} {item.unit}</span>
                              <span className="text-slate-400">{percent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td> */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-slate-700">{formatCurrency(item.unit_rate, po.currency)}</span>
                            <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-tighter mt-0.5">
                              +{(item.cgst_percent || 0) + (item.sgst_percent || 0) || 18}% GST
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-slate-800">
                              {formatCurrency(item.amount || ((item.design_qty || item.quantity || 0) * (item.unit_rate || 0)), po.currency)}
                            </span>
                            <div className="flex gap-2 text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                              <span>C: {formatCurrency(item.cgst_amount || (item.quantity * item.unit_rate * 0.09), po.currency)}</span>
                              <span>S: {formatCurrency(item.sgst_amount || (item.quantity * item.unit_rate * 0.09), po.currency)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 bg-slate-50/30 border-t border-slate-50 space-y-3">
              <div className="flex justify-end gap-12 text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">Subtotal</span>
                <span className="text-slate-600 font-black w-32 text-right">{formatCurrency(filteredItems.reduce((sum, i) => sum + (parseFloat(i.amount) || (i.quantity * i.unit_rate)), 0), po.currency)}</span>
              </div>
              <div className="flex justify-end gap-12 text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">GST (CGST 9% + SGST 9%)</span>
                <span className="text-emerald-500 font-black w-32 text-right">+ {formatCurrency(filteredItems.reduce((sum, i) => sum + (parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0)) || (i.quantity * i.unit_rate * 0.18), 0), po.currency)}</span>
              </div>
            </div>
            <div className="bg-blue-600 px-8 py-4 flex justify-between items-center text-white">
              <span className="text-xs font-black uppercase tracking-[0.2em]">Grand Total</span>
              <span className="text-xl font-black">{formatCurrency(po.total_amount || filteredItems.reduce((sum, i) => sum + (parseFloat(i.total_amount) || (i.quantity * i.unit_rate * 1.18)), 0), po.currency)}</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Document Info</h4>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Created By</p>
                  <p className="text-[11px] font-black text-slate-700 mt-0.5">{po.created_by_name || 'System Administrator'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Creation Date</p>
                  <p className="text-[11px] font-black text-slate-700 mt-0.5">{formatDate(po.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">Quick Actions</p>
            {[
              { label: 'Supplier Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'blue' },
              { label: 'Related GRNs', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7', color: 'blue' },
              { label: 'Purchase Invoices', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'blue' },
            ].map((action, idx) => (
              <button
                key={idx}
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[20px] shadow-sm hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-white rounded-lg border border-slate-50 text-blue-600 shadow-sm group-hover:scale-110 transition-transform`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={action.icon} /></svg>
                  </div>
                  <span className="text-xs font-black text-slate-700 tracking-tight">{action.label}</span>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetail;
