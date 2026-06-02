import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ChevronRight, 
  Package, 
  Printer, 
  Download, 
  Clock, 
  Send, 
  Inbox, 
  CheckCircle2, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Check, 
  Truck, 
  CreditCard,
  Building2,
  FileText,
  AlertCircle,
  User
} from 'lucide-react';
import Swal from 'sweetalert2';

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

const PurchaseOrderDetail = ({ po, onBack, onRefresh }) => {
  const navigate = useNavigate();
  if (!po) return null;

  const steps = [
    { label: 'Draft', status: ['DRAFT'], icon: Clock },
    { label: 'Submitted', status: ['SUBMITTED', 'ORDERED', 'Sent ', 'PO_REQUEST'], icon: Send },
    { label: 'Goods Arrival', status: ['RECEIVED', 'ACKNOWLEDGED'], icon: Inbox },
    { label: 'Fulfilled', status: ['COMPLETED', 'CLOSED', 'FULFILLED'], icon: CheckCircle2 },
  ];

  const currentStatus = po.status?.toUpperCase() || 'DRAFT';
  const getStepIndex = (status) => {
    if (['COMPLETED', 'CLOSED', 'FULFILLED'].includes(status)) return 3;
    if (['RECEIVED', 'ACKNOWLEDGED'].includes(status)) return 2;
    if (['SUBMITTED', 'Sent ', 'ORDERED', 'PO_REQUEST'].includes(status)) return 1;
    return 0;
  };

  const handleSubmitPO = async () => {
    try {
      const result = await Swal.fire({
        title: 'Submit Purchase Order?',
        text: 'This will finalize the order and allow material receipt.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Submit',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#059669'
      });

      if (!result.isConfirmed) return;

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'SUBMITTED' })
      });

      if (response.ok) {
        Swal.fire('Submitted!', 'PO has been submitted successfully.', 'success');
        if (onRefresh) onRefresh();
      } else {
        throw new Error('Failed to submit PO');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleCreateReceipt = () => {
    navigate('/procurement/po-receipts', { state: { poId: po.id, autoOpen: true } });
  };

  const handleReceiveMaterial = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'FULFILLED' })
      });

      if (response.ok) {
        if (onRefresh) {
          onRefresh();
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/purchase-orders/${po.id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PurchaseOrder_${po.po_number || po.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Swal.fire('Error', 'Failed to download PDF', 'error');
    }
  };

  const activeStepIndex = getStepIndex(currentStatus);
  const filteredItems = (po.items || []).filter(item => {
    const type = (item.material_type || '').toUpperCase();
    return type !== 'FG' && type !== 'FINISHED GOOD' && type !== 'SUB_ASSEMBLY' && type !== 'SUB ASSEMBLY';
  });

  const subtotal = filteredItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.unit_rate) || 0;
    return sum + (qty * rate);
  }, 0) || 0;

  const totalTax = filteredItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.unit_rate) || 0;
    const itemAmount = qty * rate;
    const cgst = parseFloat(item.cgst_amount) || (itemAmount * 0.09);
    const sgst = parseFloat(item.sgst_amount) || (itemAmount * 0.09);
    return sum + cgst + sgst;
  }, 0) || 0;
  const grandTotal = subtotal + totalTax;

  return (
    <div className="space-y-2 p-4 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 flex items-center justify-center rounded-md bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-200 active:scale-95 shadow-sm"
            title="Back to List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Buying</span>
              <ChevronRight className="w-2.5 h-2.5" />
              <span 
                className="cursor-pointer hover:text-blue-600 transition-colors"
                onClick={onBack}
              >
                Purchase Orders
              </span>
              <ChevronRight className="w-2.5 h-2.5" />
              <span className="text-blue-600 ">{po.po_number}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-xl  text-slate-900 ">{po.po_number}</h1>
              <div className="flex items-center gap-1.5 p-2  bg-white border border-slate-200 rounded text-xs   ">
                <div className={`w-2 h-2 rounded  ${activeStepIndex === 3 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <span className="text-slate-600 ">{po.status?.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['SUBMITTED', 'Sent ', 'RECEIVED', 'ACKNOWLEDGED'].includes(currentStatus) && (
            <button 
              onClick={handleReceiveMaterial}
              className="flex items-center gap-2  p-2 bg-blue-600 text-white rounded  text-xs  shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95  "
            >
              <Package className="w-4 h-4" />
              Receive Material
            </button>
          )}
          <button 
            onClick={handlePrint}
            className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded  transition-all  active:scale-95"
            title="Print PO"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded  transition-all  active:scale-95"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="">
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
              <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`rounded p-2 flex items-center justify-center border-2 transition-all duration-500 ${isCompleted || isFinished ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' : isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 text-slate-300'}`}>
                  <step.icon className={`w-4 h-4 ${isCompleted || isFinished || isActive ? 'text-white' : 'text-slate-300'}`} />
                </div>
                <div className="text-center">
                  <p className={`text-xs    ${isCompleted || isFinished || isActive ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Left 3 columns */}
        <div className="lg:col-span-3 space-y-2">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="bg-white border border-slate-100 rounded p-2  relative overflow-hidden">
              <div className="absolute -top-2 -right-4 text-slate-50 opacity-10">
                <Building2 className="w-24 h-24" />
              </div>
              <p className="text-xs text-slate-400    mb-4">Supplier</p>
              <h3 className="text-sm  text-slate-800 mb-2 truncate">{po.vendor_name}</h3>
              <div className="inline-flex items-center gap-2  p-1  bg-blue-50 text-blue-600 rounded text-xs   border border-blue-100">
                <MapPin className="w-3 h-3" />
                Ship to Main Warehouse
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded p-2  relative overflow-hidden">
              <div className="absolute -top-2 -right-4 text-slate-50 opacity-10">
                <DollarSign className="w-24 h-24" />
              </div>
              <p className="text-xs text-slate-400    mb-4">Total Value</p>
              <h3 className="text-sm  text-slate-800 mb-2">{formatCurrency(grandTotal, po.currency)}</h3>
              <div className="flex text-sm items-center gap-1.5 text-emerald-500text-xs    ">
                <Check className="w-3 h-3" />
                INCL. ALL TAXES
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded p-2  relative overflow-hidden">
              <div className="absolute -top-2 -right-4 text-slate-50 opacity-10">
                <Calendar className="w-24 h-24" />
              </div>
              <p className="text-xs text-slate-400    mb-4">Expected By</p>
              <h3 className="text-sm  text-slate-800 mb-2">{formatDate(po.expected_delivery_date)}</h3>
              {po.expected_delivery_date && (
                <div className={`inline-flex items-center gap-1.5 p-1  rounded text-xs   border ${
                  new Date(po.expected_delivery_date) < new Date() 
                  ? 'bg-rose-50 text-rose-600 border-rose-100' 
                  : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  <Clock className="w-3 h-3" />
                  {Math.ceil((new Date(po.expected_delivery_date) - new Date()) / (1000 * 60 * 60 * 24))} Days {new Date(po.expected_delivery_date) < new Date() ? 'Overdue' : 'Left'}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-100 rounded p-2 ">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 text-blue-600 rounded ">
                  <Truck className="w-4 h-4" />
                </div>
                <h4 className="text-xs  text-slate-700  ">Shipping Details</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-start text-xs">
                  <span className="text-slate-400 ">Address</span>
                  <span className="text-slate-800  text-right max-w-[200px]">{po.vendor_location || po.vendor_address || 'No address provided'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 ">Incoterm</span>
                  <span className="p-1  bg-blue-50 text-blue-600 roundedtext-xs    border border-blue-100">{po.incoterm || 'EXW'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 ">Shipping Rule</span>
                  <span className="text-slate-800 ">{po.shipping_rule || 'Standard'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded p-2 ">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-purple-50 text-purple-600 rounded ">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h4 className="text-xs  text-slate-700  ">Payment & Others</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 ">Tax Category</span>
                  <span className="p-1  bg-slate-50 text-slate-600 roundedtext-xs    border border-slate-200">{po.tax_category || 'GST'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 ">Currency</span>
                  <span className="text-slate-800   ">{po.currency || 'INR'}</span>
                </div>
                <div className="flex justify-between items-start text-xs">
                  <span className="text-slate-400 ">Notes</span>
                  <span className="text-slate-400  italic text-right max-w-[200px]">{po.notes || 'No notes added'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-slate-100 rounded  overflow-hidden">
            <div className="p-2  border-b border-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2 ">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded ">
                  <Package className="w-4 h-4" />
                </div>
                <h4 className="text-xs  text-slate-700  ">Items List</h4>
              </div>
              <span className="text-xs  text-slate-400   bg-slate-50 p-2  rounded ">{filteredItems.length} Items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="p-2  text-xs  text-slate-400  ">Item</th>
                    <th className="p-2  text-xs  text-slate-400   text-center">Design Qty</th>
                    <th className="p-2  text-xs  text-slate-400   text-center">Required</th>
                    <th className="p-2  text-xs  text-slate-400   text-center">Rate</th>
                    <th className="p-2  text-xs  text-slate-400   text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map((item, idx) => {
                    const received = parseFloat(item.accepted_quantity) || 0;
                    const total = parseFloat(item.quantity) || 1;
                    const percent = Math.min(100, Math.round((received / total) * 100));
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-2">
                          <p className="text-xs text-slate-800 ">{item.material_name || item.description || 'N/A'}</p>
                          {(item.item_code || item.drawing_no) && (
                            <span className="inline-flex items-center p-1 rounded text-xs  bg-slate-100 text-slate-500 mt-1 uppercase tracking-wider">
                              {item.item_code || item.drawing_no}
                            </span>
                          )}
                          {(item.length > 0 || item.width > 0 || item.thickness > 0 || item.diameter > 0 || item.outer_diameter > 0) && (
                            <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                              {item.length > 0 && <span className="text-xs  text-slate-400">L: {item.length}</span>}
                              {item.width > 0 && <span className="text-xs  text-slate-400">W: {item.width}</span>}
                              {item.thickness > 0 && <span className="text-xs  text-slate-400">T: {item.thickness}</span>}
                              {item.diameter > 0 && <span className="text-xs  text-slate-400">Dia: {item.diameter}</span>}
                              {item.outer_diameter > 0 && <span className="text-xs  text-slate-400">OD: {item.outer_diameter}</span>}
                            </div>
                          )}
                        </td>
                        <td className="p-2  text-center">
                          <span className="text-xs  text-slate-800">
                            {Number(item.planned_qty || item.design_qty || 0).toFixed(3)}
                          </span>
                          <span className="text-xs  text-slate-400  ml-1 uppercase">{item.unit || item.uom}</span>
                        </td>
                        <td className="p-2  text-center">
                          <span className="text-xs  text-slate-800">
                            {Number(item.quantity || 0).toFixed(3)}
                          </span>
                          <span className="text-xs  text-slate-400  ml-1 uppercase">{item.unit || item.uom}</span>
                        </td>
                        {/* Hiding Received column as requested */}
                        {/* <td className="p-2 ">
                          <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                            <div className="flex justify-between w-full text-xs ">
                              <span className="text-blue-600">{received} {item.unit}</span>
                              <span className="text-slate-400">{percent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded  overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded  transition-all duration-700"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td> */}
                        <td className="p-2  text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs  text-slate-700">{formatCurrency(item.unit_rate, po.currency)}</span>
                          </div>
                        </td>
                        <td className="p-2  text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-xs  text-slate-800">
                              {(() => {
                                const qty = parseFloat(item.quantity) || 0;
                                const rate = parseFloat(item.unit_rate) || 0;
                                return formatCurrency(qty * rate, po.currency);
                              })()}
                            </span>
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
                <span className="text-slate-400   ">Subtotal</span>
                <span className="text-slate-600  w-32 text-right">
                  {formatCurrency(subtotal, po.currency)}
                </span>
              </div>
              <div className="flex justify-end gap-12 text-xs">
                <span className="text-slate-400   ">CGST (9%)</span>
                <span className="text-emerald-500  w-32 text-right">
                  + {formatCurrency(filteredItems.reduce((sum, i) => {
                    const qty = parseFloat(i.quantity);
                    const rate = parseFloat(i.unit_rate) || 0;
                    const tax = parseFloat(i.cgst_amount) || (qty * rate * 0.09);
                    return sum + tax;
                  }, 0), po.currency)}
                </span>
              </div>
              <div className="flex justify-end gap-12 text-xs">
                <span className="text-slate-400   ">SGST (9%)</span>
                <span className="text-emerald-500  w-32 text-right">
                  + {formatCurrency(filteredItems.reduce((sum, i) => {
                    const qty = parseFloat(i.quantity);
                    const rate = parseFloat(i.unit_rate) || 0;
                    const tax = parseFloat(i.sgst_amount) || (qty * rate * 0.09);
                    return sum + tax;
                  }, 0), po.currency)}
                </span>
              </div>
            </div>
            <div className="bg-blue-600 p-2 flex justify-between items-center text-white">
              <span className="text-xs   ">Grand Total</span>
              <span className="text-sm ">
                {formatCurrency(grandTotal, po.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-2">
          {(po.project_name || po.company_name) && (
            <div className="bg-white border border-slate-100 rounded p-2 ">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded ">
                  <Building2 className="w-4 h-4" />
                </div>
                <h4 className="text-sm  text-slate-700  ">Project Context</h4>
              </div>
              <div className="space-y-2">
                {po.project_name && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded  bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400   ">Project</p>
                      <p className="text-xs   text-slate-700 mt-0.5 ">{po.project_name}</p>
                    </div>
                  </div>
                )}
                {po.company_name && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded  bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400   ">Customer</p>
                      <p className="text-xs   text-slate-700 mt-0.5">{po.company_name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded p-2 ">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-amber-50 text-amber-600 rounded ">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h4 className="text-sm  text-slate-700  ">Document Info</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded  bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-400   ">Created By</p>
                  <p className="text-xs   text-slate-700 mt-0.5">{po.created_by_name || 'System Administrator'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded  bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-400   ">Creation Date</p>
                  <p className="text-xs   text-slate-700 mt-0.5">{formatDate(po.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-400    ml-1">Quick Actions</p>
            {[
              { label: 'Supplier Profile', icon: User, color: 'blue' },
              { label: 'Related GRNs', icon: Truck, color: 'blue' },
              { label: 'Purchase Invoices', icon: FileText, color: 'blue' },
            ].map((action, idx) => (
              <button
                key={idx}
                className="w-full flex items-center justify-between p-2 bg-white border border-slate-100 rounded   hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className={`p-2 bg-white rounded  border border-slate-50 text-blue-600  group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs  text-slate-700 ">{action.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetail;
