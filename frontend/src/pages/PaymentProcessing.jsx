import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, RefreshCw, Eye, Download, Send, Calendar, Clock, CreditCard, CheckSquare, FileText, Upload, AlertCircle } from 'lucide-react';
import { DataTable, Button, Modal, FormControl } from '../components/ui.jsx';
import { errorToast, successToast } from '../utils/toast';
import ProcessPaymentModal from '../components/ProcessPaymentModal.jsx';
import SendEmailModal from '../components/SendEmailModal.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PaymentProcessing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [emailModalData, setEmailModalData] = useState(null);
  const [verifyInvoiceId, setVerifyInvoiceId] = useState(null);
  const [verifyInvoiceData, setVerifyInvoiceData] = useState(null);
  
  // Verification form state
  const [verifyForm, setVerifyForm] = useState({
    vendor_invoice_no: '',
    invoice_date: '',
    invoice_amount: '',
    gst_amount: '',
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendor-invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      errorToast('Failed to fetch invoice data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerifyModal = async (invoiceId) => {
    try {
      setVerifyLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/vendor-invoices/${invoiceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch invoice details');
      const data = await response.json();
      
      setVerifyInvoiceData(data);
      setVerifyForm({
        vendor_invoice_no: data.vendor_invoice_no || '',
        invoice_date: data.invoice_date ? data.invoice_date.split('T')[0] : '',
        invoice_amount: data.invoice_amount || '',
        gst_amount: data.gst_amount || ''
      });
      setUploadFile(null);
      setVerifyInvoiceId(invoiceId);
      setIsVerifyModalOpen(true);
    } catch (error) {
      errorToast(error.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSaveVerifyDetails = async (e, shouldVerify = false) => {
    if (e) e.preventDefault();
    try {
      setVerifyLoading(true);
      const token = localStorage.getItem('authToken');
      
      const formData = new FormData();
      formData.append('vendor_invoice_no', verifyForm.vendor_invoice_no);
      formData.append('invoice_date', verifyForm.invoice_date);
      formData.append('invoice_amount', verifyForm.invoice_amount);
      formData.append('gst_amount', verifyForm.gst_amount);
      if (uploadFile) {
        formData.append('invoiceFile', uploadFile);
      }

      const response = await fetch(`${API_BASE}/vendor-invoices/${verifyInvoiceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save invoice details');
      }

      if (shouldVerify) {
        const verifyRes = await fetch(`${API_BASE}/vendor-invoices/${verifyInvoiceId}/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!verifyRes.ok) throw new Error('Failed to verify PO and GRN');
        successToast('Purchase Order has been forwarded to accounts and verified successfully.');
      } else {
        successToast('Vendor invoice details saved successfully.');
      }

      setIsVerifyModalOpen(false);
      fetchInvoices();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSendEmailClick = (row) => {
    setEmailModalData({
      to: row.vendor_email || '',
      subject: `Invoice: ${row.po_number}`,
      message: `Dear ${row.vendor_name},\n\nPlease find attached the invoice ${row.po_number}.\n\nRegards,\nSPTECHPIONEER Accounts Team`,
      po_id: row.po_id,
      po_number: row.po_number,
      vendor_name: row.vendor_name,
      type: 'PURCHASE_ORDER'
    });
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async (emailData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/payments/vendor-invoice/${emailModalData.po_id}/send-email?type=PURCHASE_ORDER`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          attachPDF: emailData.attachPDF,
          customAttachments: emailData.customAttachments
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send email');
      }

      successToast('Vendor invoice sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
      errorToast(error.message || 'Failed to send email');
    }
  };

  const handleDownloadFile = (filePath) => {
    if (!filePath) return;
    const link = document.createElement('a');
    link.href = `${API_BASE.replace('/api', '')}/${filePath.replace(/\\/g, '/')}`;
    link.setAttribute('download', filePath.split('/').pop());
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const columns = [
    {
      label: 'PO / Invoice',
      key: 'po_number',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col py-1">
          <span className="text-rose-600 font-semibold">{val}</span>
          {row.vendor_invoice_no && (
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">Inv: {row.vendor_invoice_no}</span>
          )}
        </div>
      )
    },
    {
      label: 'Supplier',
      key: 'vendor_name',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs shadow-sm">
            {val ? val.substring(0, 2).toUpperCase() : 'V'}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">{val}</span>
            <span className="text-[10px] text-slate-400">ID: {row.vendor_id}</span>
          </div>
        </div>
      )
    },
    {
      label: 'Project',
      key: 'project_name',
      sortable: true,
      render: (val) => <span className="text-xs text-slate-700 font-medium">{val || '—'}</span>
    },
    {
      label: 'PO Amount',
      key: 'po_amount',
      sortable: true,
      render: (val) => <span className="text-slate-900 font-medium">{formatCurrency(val)}</span>
    },
    {
      label: 'Paid Amount',
      key: 'already_paid',
      sortable: true,
      render: (val) => <span className="text-emerald-600 font-medium">{formatCurrency(val)}</span>
    },
    {
      label: 'Outstanding',
      key: 'outstanding',
      sortable: true,
      render: (val) => <span className="text-rose-600 font-semibold">{formatCurrency(val)}</span>
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (status) => {
        let styles = 'bg-slate-50 text-slate-700 border-slate-100';
        let label = status;
        if (status === 'FORWARDED') {
          styles = 'bg-blue-50 text-blue-700 border-blue-100';
          label = 'FORWARDED';
        } else if (status === 'RECEIVED') {
          styles = 'bg-amber-50 text-amber-700 border-amber-100';
          label = 'INVOICE RECEIVED';
        } else if (status === 'VERIFIED') {
          styles = 'bg-indigo-50 text-indigo-700 border-indigo-100';
          label = 'INVOICE VERIFIED';
        } else if (status === 'COMPLETED') {
          styles = 'bg-emerald-50 text-emerald-700 border-emerald-100';
          label = 'COMPLETED';
        }
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${styles}`}>
            {label}
          </span>
        );
      }
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex justify-end items-center gap-2">
          {/* Verify Invoice Info */}
          {['FORWARDED', 'RECEIVED'].includes(row.status) && (
            <button
              onClick={() => handleOpenVerifyModal(row.id)}
              className="p-1.5 hover:bg-amber-50 rounded text-amber-600 hover:text-amber-700 border border-transparent hover:border-amber-100 active:scale-95 transition-all flex items-center gap-1"
              title="Verify PO & GRN"
            >
              <CheckSquare className="w-4 h-4" />
              <span className="text-[10px] font-bold">Verify</span>
            </button>
          )}

          {/* Process Payment */}
          {parseFloat(row.outstanding) > 0 && (
            <button
              onClick={() => {
                // ProcessPaymentModal expects invoice.id = PO ID (not vendor_invoice id)
                setSelectedInvoice({
                  id: row.po_id,
                  vendor_invoice_id: row.id,
                  po_number: row.po_number,
                  vendor_name: row.vendor_name,
                  vendor_id: row.vendor_id,
                  total_amount: row.po_amount,
                  outstanding: row.outstanding,
                  already_paid: row.already_paid,
                  created_at: row.created_at,
                  type: 'PURCHASE_ORDER'
                });
                setIsPaymentModalOpen(true);
              }}
              className="p-1.5 hover:bg-emerald-50 rounded text-emerald-600 hover:text-emerald-700 border border-transparent hover:border-emerald-100 active:scale-95 transition-all flex items-center gap-1"
              title="Process Payment"
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-[10px] font-bold">Payment</span>
            </button>
          )}

          {/* Email Attachments */}
          <button
            onClick={() => handleSendEmailClick(row)}
            className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
            title="Send Email"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
            <Clock size={24} />
          </div>
          <div>
            <h1 className="text-xl text-slate-900">Vendor Invoices</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage handover, verification, and payment voucher generation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchInvoices}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
            title="Refresh Data"
          />
        </div>
      </div>

      <div className="overflow-hidden my-4">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchPlaceholder="Search invoices by PO, Project or Supplier..."
          className="border-none"
        />
      </div>

      {/* Verify & Record Details Modal */}
      {isVerifyModalOpen && verifyInvoiceData && (
        <Modal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          title="Forwarded Purchase Order Verification"
          size="lg"
        >
          <form onSubmit={(e) => handleSaveVerifyDetails(e, false)} className="space-y-4 text-xs text-slate-800">
            
            {/* Purchase Order Details */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
              <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Purchase Order Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">PO NUMBER</span>
                  <span className="font-medium text-slate-700">{verifyInvoiceData.po_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">PO DATE</span>
                  <span className="font-medium text-slate-700">{formatDate(verifyInvoiceData.po_date)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">SUPPLIER</span>
                  <span className="font-medium text-slate-700">{verifyInvoiceData.vendor_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">PROJECT</span>
                  <span className="font-medium text-slate-700">{verifyInvoiceData.project_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">MR NO</span>
                  <span className="font-medium text-slate-700">{verifyInvoiceData.mr_number || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">DRAWING NO</span>
                  <span className="font-medium text-slate-700">{verifyInvoiceData.drawing_no || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">PO AMOUNT</span>
                  <span className="font-semibold text-indigo-600">{formatCurrency(verifyInvoiceData.po_amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">PO PDF ATTACHMENT</span>
                  {verifyInvoiceData.po_pdf_path ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(verifyInvoiceData.po_pdf_path)}
                      className="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View PO.pdf
                    </button>
                  ) : (
                    <span className="text-slate-400 font-medium">None</span>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-100 rounded overflow-hidden bg-white">
              <div className="bg-slate-100 p-2 font-semibold text-slate-900 border-b">PO Line Items</div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="p-2">Item ID</th>
                    <th className="p-2">Material / Drawing</th>
                    <th className="p-2 text-center">Quantity</th>
                    <th className="p-2 text-right">Unit Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(verifyInvoiceData.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 font-mono text-[11px] text-slate-500">{item.item_code}</td>
                      <td className="p-2 font-medium">{item.material_name || item.description || '—'}</td>
                      <td className="p-2 text-center">{parseFloat(item.quantity).toFixed(3)} {item.unit}</td>
                      <td className="p-2 text-right">{formatCurrency(item.unit_rate)}</td>
                      <td className="p-2 text-right font-medium text-slate-700">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vendor Invoice Inputs Form */}
            <div className="bg-blue-50/30 border border-blue-100 rounded p-3 space-y-3">
              <h4 className="font-semibold text-slate-900 mb-1 border-b border-blue-100 pb-1">Vendor Invoice Entry</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">INVOICE NUMBER *</label>
                  <input
                    type="text"
                    required
                    value={verifyForm.vendor_invoice_no}
                    onChange={(e) => setVerifyForm({ ...verifyForm, vendor_invoice_no: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                    placeholder="Enter Invoice No"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">INVOICE DATE *</label>
                  <input
                    type="date"
                    required
                    value={verifyForm.invoice_date}
                    onChange={(e) => setVerifyForm({ ...verifyForm, invoice_date: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">INVOICE AMOUNT (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={verifyForm.invoice_amount}
                    onChange={(e) => setVerifyForm({ ...verifyForm, invoice_amount: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">GST AMOUNT (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={verifyForm.gst_amount}
                    onChange={(e) => setVerifyForm({ ...verifyForm, gst_amount: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">UPLOAD VENDOR INVOICE PDF</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="text-xs p-1 border border-slate-200 rounded bg-white flex-1"
                  />
                  {verifyInvoiceData.invoice_pdf_path && (
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(verifyInvoiceData.invoice_pdf_path)}
                      className="p-2 hover:bg-slate-100 rounded text-slate-600 flex items-center gap-1 border"
                      title="Download uploaded vendor invoice PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      View Invoice.pdf
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2 justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(false)}
                className="px-3 py-2 border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifyLoading}
                className="px-3 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
              >
                Save Details
              </button>
              <button
                type="button"
                disabled={verifyLoading || !verifyForm.vendor_invoice_no || !verifyForm.invoice_date || !verifyForm.invoice_amount}
                onClick={(e) => handleSaveVerifyDetails(e, true)}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Verify PO & GRN
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment Processing Modal */}
      <ProcessPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={selectedInvoice}
        onSuccess={() => fetchInvoices()}
      />

      {/* Send Email Modal */}
      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        data={emailModalData}
        onSend={handleSendEmail}
        title="Send Invoice to Vendor"
        subTitle={`${emailModalData?.po_number} • ${emailModalData?.vendor_name}`}
        attachmentName={`Invoice-${emailModalData?.po_number}.pdf`}
      />
    </div>
  );
};

export default PaymentProcessing;
