import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

const receiptStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  SENT: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
  RECEIVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Received' },
  ACKNOWLEDGED: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', label: 'Acknowledged' },
  CLOSED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', label: 'Closed' }
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const POReceiptDetails = () => {
  const { receiptId } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPOItems = useCallback(async (poId, token) => {
    try {
      const response = await fetch(`${API_BASE}/purchase-orders/${poId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const poData = await response.json();
        setPoItems(poData.items || []);
      }
    } catch (error) {
      console.error('Error fetching PO items:', error);
    }
  }, []);

  const fetchReceiptDetails = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipt details');
      const data = await response.json();
      setReceipt(data);

      if (data.po_id) {
        fetchPOItems(data.po_id, token);
      }
    } catch (error) {
      errorToast(error.message || 'Failed to load receipt details');
    } finally {
      setLoading(false);
    }
  }, [receiptId, fetchPOItems]);

  useEffect(() => {
    fetchReceiptDetails();
  }, [receiptId, fetchReceiptDetails]);

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/po-receipts/${receiptId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO_Receipt_${receipt.po_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        successToast('PDF downloaded successfully');
      } else {
        errorToast('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      errorToast('Failed to download PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="text-center">
          <p className="text-slate-500">Loading receipt details...</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="text-center">
          <p className="text-slate-500">Receipt not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl text-slate-900">PO Receipt Details</h1>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 border border-slate-200 rounded text-sm font-medium hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <Card className="bg-white rounded-lg shadow">
          <div className="p-8">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">PO Number</p>
                <p className="text-xl text-slate-900">{receipt.po_number || '—'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Vendor</p>
                <p className="text-xl text-slate-900">{receipt.vendor_name || '—'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Receipt Date</p>
                <p className="text-xl text-slate-900">{formatDate(receipt.receipt_date)}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm  ${receiptStatusColors[receipt.status]?.badge}`}>
                  {receiptStatusColors[receipt.status]?.label || receipt.status}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Received Quantity</p>
                <p className="text-2xl  text-emerald-600">{receipt.received_quantity || 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <p className="text-xs text-slate-500  tracking-wider  mb-1">Created</p>
                <p className="text-xl text-slate-900">{formatDate(receipt.created_at)}</p>
              </div>
            </div>

            {/* Total Amount */}
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded mb-8">
              <p className="text-xs text-emerald-600  tracking-wider  mb-2">Total Amount</p>
              <p className="text-4xl  text-emerald-700">₹{receipt.total_amount?.toLocaleString('en-IN') || '0'}</p>
            </div>

            {/* Items Table */}
            {poItems.length > 0 && (
              <div className="mb-8">
                <h3 className="text-md text-slate-900 text-xs mb-4">PO Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600 ">
                      <tr>
                        <th className="p-2 text-left ">Description</th>
                        <th className="px-4 py-3 text-center ">Qty</th>
                        <th className="px-4 py-3 text-right ">Rate</th>
                        <th className="px-4 py-3 text-right ">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-600">{item.description || '—'}</td>
                          <td className="px-4 py-3 text-center font-medium text-slate-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-600">₹{parseFloat(item.unit_rate || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right  text-emerald-600">₹{parseFloat(item.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {receipt.notes && (
              <div className="mb-8 bg-blue-50 border border-blue-200 p-6 rounded">
                <p className="text-xs text-blue-600  tracking-wider  mb-2">Notes</p>
                <p className="text-slate-700 text-sm leading-relaxed">{receipt.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm  hover:bg-blue-700 disabled:bg-blue-400"
              >
                {exporting ? 'Exporting...' : '📄 Export Report'}
              </button>
              <button
                onClick={() => window.close()}
                className="px-6 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default POReceiptDetails;

