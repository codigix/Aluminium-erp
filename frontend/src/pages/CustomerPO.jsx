import React, { useState, useMemo } from 'react'

const CustomerPO = ({
  formatCurrency,
  onApproveQuotation,
  onSendToDesign,
  onUpdateQuotationRates,
  quotationRequests,
  quotationRequestsLoading,
  poQuotePrices,
  onQuotePriceChange
}) => {
  const [expandedQuoteKey, setExpandedQuoteKey] = useState(null)

  // Group quotation requests by company/batch for "Received" tab
  const groupedQuotes = useMemo(() => {
    const grouped = {}
    quotationRequests.forEach(quote => {
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
          status: 'SENT', 
          total_amount: 0,
          quotes: []
        }
      }
      grouped[key].quotes.push(quote)
      if (quote.status !== 'REJECTED') {
        grouped[key].total_amount += parseFloat(quote.total_amount) || 0
      }
    })

    // Post-process groups to determine batch status
    Object.values(grouped).forEach(group => {
      const activeQuotes = group.quotes.filter(q => q.status !== 'REJECTED');
      
      if (activeQuotes.length === 0) {
        group.status = 'REJECTED';
      } else if (activeQuotes.every(q => q.status === 'APPROVED' || q.status === 'COMPLETED' || q.status === 'PARTIAL')) {
        group.status = 'COMPLETED';
      } else if (activeQuotes.some(q => q.status === 'APPROVAL')) {
        group.status = 'APPROVAL';
      } else {
        group.status = 'SENT';
      }
    });

    return Object.values(grouped)
  }, [quotationRequests])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div>
            <h1 className="text-xl text-slate-900 mb-1">Customer Purchase Orders</h1>
            <p className="text-slate-600 text-xs">Manage and track purchase orders received from customers</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-2">
            <div className="flex justify-between items-center">
              <h2 className="text-xs  text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Received Quotations (Send for Approval)
              </h2>
            </div>
          </div>

          <div className="p-0">
            {quotationRequestsLoading ? (
              <div className="py-12 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-600  text-sm">Loading quotations...</p>
              </div>
            ) : groupedQuotes.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <p className="text-slate-500 ">No received quotations found</p>
                <p className="text-slate-400 text-sm mt-1">Quotations sent from the Sales module will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-100">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Quote ID / Client</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Sent Date</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Total Amount</th>
                      <th className="p-2 text-left text-xs  text-slate-700 ">Status</th>
                      <th className="p-2 text-right text-xs  text-slate-700 ">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {groupedQuotes.map((group) => {
                      const isExpanded = expandedQuoteKey === group.uniqueKey;
                      return (
                        <React.Fragment key={group.uniqueKey}>
                          <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setExpandedQuoteKey(isExpanded ? null : group.uniqueKey)}>
                            <td className="p-2">
                              <div className=" text-indigo-600 text-xs flex items-center gap-2">
                                <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                QRT-{group.id.toString().padStart(4, '0')}
                              </div>
                              <div className="text-[0.65rem] text-slate-500 mt-0.5 ml-4 ">{group.company_name}</div>
                            </td>
                            <td className="p-2">
                              <div className="text-xs text-slate-600 ">
                                {new Date(group.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col">
                                <span className="text-slate-400 text-[10px] font-normal">Incl. GST (18%)</span>
                                <span className="text-xs text-emerald-600 ">{formatCurrency(group.total_amount * 1.18)}</span>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[0.6rem]   tracking-wider ${
                                group.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                                group.status === 'APPROVAL' ? 'bg-blue-100 text-blue-700' :
                                group.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {group.status === 'COMPLETED' ? 'APPROVED' : group.status}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              <button 
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                                title={isExpanded ? 'Hide Details' : 'View Details'}
                              >
                                {isExpanded ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                  </svg>
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="5" className="p-4 bg-slate-50/50">
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="p-2 text-left text-slate-500 ">Drawing No</th>
                                        <th className="p-2 text-left text-slate-500 ">Description</th>
                                        <th className="p-2 text-center text-slate-500 ">Qty</th>
                                        <th className="p-2 text-right text-slate-500 ">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {group.quotes
                                        .filter(item => item.status !== 'REJECTED')
                                        .map((item) => {
                                        return (
                                          <React.Fragment key={`quote-item-${item.id}`}>
                                            <tr className="hover:bg-slate-50">
                                              <td className="p-2">
                                                <div className="flex flex-col gap-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-slate-900 font-medium">{item.drawing_no}</span>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="p-2 text-slate-600">{item.item_description || '—'}</td>
                                              <td className="p-2 text-center ">
                                                {item.item_qty !== null ? Number(item.item_qty).toFixed(0) : '0'} {item.item_unit || 'NOS'}
                                              </td>
                                              <td className="p-2 text-right text-slate-900">
                                                {formatCurrency(item.total_amount)}
                                              </td>
                                            </tr>
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                      <tr>
                                        <td colSpan="3" className="p-2 text-right text-xs text-slate-600">Sub Total:</td>
                                        <td className="p-2 text-right text-xs text-slate-900">{formatCurrency(group.total_amount)}</td>
                                      </tr>
                                      <tr>
                                        <td colSpan="3" className="p-2 text-right text-xs text-slate-600">GST (18%):</td>
                                        <td className="p-2 text-right text-xs text-slate-900">{formatCurrency(group.total_amount * 0.18)}</td>
                                      </tr>
                                      <tr className="bg-indigo-50">
                                        <td colSpan="3" className="p-2 text-right text-xs text-indigo-700 font-medium">Grand Total (Incl. GST):</td>
                                        <td className="p-2 text-right text-sm text-indigo-600 ">{formatCurrency(group.total_amount * 1.18)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                                <div className="mt-3 flex justify-end gap-3">
                                  {['PENDING', 'SENT'].includes(group.status) && (
                                    <button
                                      onClick={() => onSendToDesign(group.quotes.filter(q => q.status !== 'REJECTED'))}
                                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[0.65rem]  hover:bg-indigo-700 transition-colors  tracking-wider flex items-center gap-2"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                      </svg>
                                      Create Quotation & Send to Design
                                    </button>
                                  )}
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
    </div>
  )
}

export default CustomerPO

