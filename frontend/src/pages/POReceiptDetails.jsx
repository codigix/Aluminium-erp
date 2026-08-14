import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card } from '../components/ui.jsx';
import DataTable from '../components/DataTable.jsx';
import { successToast, errorToast } from '../utils/toast';
import { formatDimensions } from '../utils/formatters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const receiptStatusColors = {
  DRAFT: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Draft' },
  Sent : { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Sent' },
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

  const getItemVars = (item) => {
    const isBoughtOut = (item.material_type || item.item_type || '').toUpperCase().trim().includes('BOUGHT') || (item.item_code && String(item.item_code).toUpperCase().startsWith('BO-'));
    const dQty = parseFloat(item.planned_qty || item.design_qty || (isBoughtOut ? (item.quantity || item.received_quantity) : 0) || 0);
    const reqWt = isBoughtOut ? 0 : parseFloat(item.required_qty || item.expected_quantity || item.quantity || 0);
    
    const rawRecQty = parseFloat(item.received_qty);
    const rawRecWt = parseFloat(item.received_weight);
    
    const recWt = isBoughtOut ? 0 : ((!isNaN(rawRecWt) && rawRecWt > 0) ? rawRecWt : parseFloat(item.received_quantity || 0));
    const recQty = (!isNaN(rawRecQty) && rawRecQty > 0) ? rawRecQty : dQty;

    const pQty = Math.max(0, dQty - recQty);
    const pWt = isBoughtOut ? 0 : parseFloat(Math.max(0, reqWt - recWt).toFixed(3));
    const unitStr = isBoughtOut ? 'NOS' : (item.unit || item.uom || 'KG').toUpperCase();

    return { isBoughtOut, dQty, reqWt, recWt, recQty, pQty, pWt, unitStr };
  };

  const detailColumns = [
    {
      key: 'drawing_no',
      label: 'Drawing No',
      width: '15%',
      render: (val, row) => <span className="font-bold text-slate-900">{row.drawing_no || '—'}</span>
    },
    {
      key: 'item_code',
      label: 'Item',
      width: '25%',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.item_code}</div>
          <div className="text-slate-500 mt-0.5">{row.material_name || row.description}</div>
          {formatDimensions(row) && (
            <div className="mt-0.5">
              <span className="text-[10px] text-slate-400">{formatDimensions(row)}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'design_qty',
      label: 'Design Qty',
      className: 'text-center',
      width: '10%',
      render: (val, row) => {
        const { dQty } = getItemVars(row);
        return (
          <div className="text-slate-600">
            <span className="font-medium">{dQty.toFixed(0)}</span> <span className="text-[10px] text-slate-400">NOS</span>
          </div>
        );
      }
    },
    {
      key: 'required_qty',
      label: 'Required Weight',
      className: 'text-center',
      width: '12%',
      render: (val, row) => {
        const { isBoughtOut, reqWt, unitStr } = getItemVars(row);
        if (isBoughtOut) return <span className="font-medium text-slate-400">—</span>;
        return (
          <div className="text-slate-700">
            <span className="font-medium">{reqWt.toFixed(3)}</span> <span className="text-[10px] text-slate-400">{unitStr}</span>
          </div>
        );
      }
    },
    {
      key: 'received_qty',
      label: 'Received Qty',
      className: 'text-center',
      width: '12%',
      render: (val, row) => {
        const { recQty } = getItemVars(row);
        return (
          <div className="text-blue-600 font-bold">
            <span>{recQty.toFixed(0)}</span> <span className="text-[10px] text-slate-400">NOS</span>
          </div>
        );
      }
    },
    {
      key: 'received_weight',
      label: 'Received Weight',
      className: 'text-center',
      width: '12%',
      render: (val, row) => {
        const { isBoughtOut, recWt, unitStr } = getItemVars(row);
        if (isBoughtOut) return <span className="font-medium text-slate-400">—</span>;
        return (
          <div className="text-indigo-600 font-bold">
            <span>{recWt.toFixed(3)}</span> <span className="text-[10px] text-slate-400">{unitStr}</span>
          </div>
        );
      }
    },
    {
      key: 'pending_qty',
      label: 'Pending Qty',
      className: 'text-center',
      width: '12%',
      render: (val, row) => {
        const { pQty } = getItemVars(row);
        return (
          <div className="text-amber-600 font-bold">
            <span>{pQty.toFixed(0)}</span> <span className="text-[10px] text-slate-400">NOS</span>
          </div>
        );
      }
    },
    {
      key: 'pending_weight',
      label: 'Pending Weight',
      className: 'text-center',
      width: '12%',
      render: (val, row) => {
        const { isBoughtOut, pWt, unitStr } = getItemVars(row);
        if (isBoughtOut) return <span className="font-medium text-slate-400">—</span>;
        return (
          <div className="text-amber-600 font-bold">
            <span>{pWt.toFixed(3)}</span> <span className="text-[10px] text-slate-400">{unitStr}</span>
          </div>
        );
      }
    }
  ];

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 flex items-center justify-center rounded-md bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-200 active:scale-95 shadow-sm"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl text-slate-900">PO Receipt Details</h1>
          </div>
          <button
            onClick={() => window.close()}
            className="p-2  border border-slate-200 rounded text-xs  hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <Card className="bg-white rounded  shadow">
          <div className="p-8">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500    mb-1">PO Number</p>
                <p className="text-xl text-slate-900">{receipt.po_number || '—'}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500    mb-1">Vendor</p>
                <p className="text-xl text-slate-900">{receipt.vendor_name || '—'}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500    mb-1">Receipt Date</p>
                <p className="text-xl text-slate-900">{formatDate(receipt.receipt_date)}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500    mb-1">Status</p>
                <span className={`inline-block p-2  rounded  text-sm  ${receiptStatusColors[receipt.status]?.badge}`}>
                  {receiptStatusColors[receipt.status]?.label || receipt.status}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500    mb-1">Received Quantity</p>
                <p className="text-xl   text-emerald-600">{receipt.received_quantity || 0}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <p className="text-xs text-slate-500    mb-1">Created</p>
                <p className="text-xl text-slate-900">{formatDate(receipt.created_at)}</p>
              </div>
            </div>

            {/* Total Amount */}
            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded mb-8">
              <p className="text-xs text-emerald-600    mb-2">Total Amount</p>
              <p className="text-4xl  text-emerald-700">₹{receipt.total_amount?.toLocaleString('en-IN') || '0'}</p>
            </div>

            {/* Items Table */}
            {((receipt?.items && receipt.items.length > 0) || poItems.length > 0) && (
              <div className="mb-8">
                <h3 className="text-md text-slate-900 font-bold mb-4">Received Items</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <DataTable
                    columns={detailColumns}
                    data={(receipt?.items && receipt.items.length > 0) ? receipt.items : poItems}
                    loading={false}
                    hideHeader={true}
                    pageSize={100}
                    className="border-none shadow-none rounded-none"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            {receipt.notes && (
              <div className="mb-8 bg-blue-50 border border-blue-200 p-2 rounded">
                <p className="text-xs text-blue-600    mb-2">Notes</p>
                <p className="text-slate-700 text-sm leading-relaxed">{receipt.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-6 border-t border-slate-200">
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2  p-2 bg-blue-600 text-white rounded  text-sm  hover:bg-blue-700 disabled:bg-blue-400"
              >
                {exporting ? 'Exporting...' : '📄 Export Report'}
              </button>
              <button
                onClick={() => window.close()}
                className="p-2 border border-slate-200 rounded  text-sm  text-slate-600 hover:bg-slate-50"
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

