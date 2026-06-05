import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Save,
  Check,
  History,
  FileText,
  Eye,
  Edit
} from 'lucide-react';
import { StatusBadge } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatDisplayDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value // Fallback to raw value if string is not a date
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const rejectionReasons = [
  'Dimensional Deviation',
  'Surface Scratch',
  'Dent/Damage',
  'Wrong Cutting',
  'Powder Coating Defect',
  'Material Crack',
  'Other'
];

const QualityRejectionEntry = () => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Pending entry from production has been added to the queue and is ready for quality inspection.');
  const [records, setRecords] = useState([]);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'view' or 'edit'
  
  // State for edit form inputs
  const [editAccepted, setEditAccepted] = useState('');
  const [editRejected, setEditRejected] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editScrap, setEditScrap] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const openViewModal = (record) => {
    setSelectedRecord(record);
    setModalMode('view');
  };

  const openEditModal = (record) => {
    setSelectedRecord(record);
    setModalMode('edit');
    setEditAccepted(record.accepted);
    setEditRejected(record.rejected);
    setEditReason(record.reason);
    setEditScrap(record.scrapQty);
    setEditNotes(record.notes);
  };

  const handleEditAcceptedChange = (val) => {
    const cleanValue = val.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    const sanitizedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanValue;
    
    setEditAccepted(sanitizedValue);
    
    const produced = parseFloat(selectedRecord.producedQty) || 0;
    const acceptedVal = sanitizedValue === '' ? 0 : (parseFloat(sanitizedValue) || 0);
    const rejectedVal = Math.max(0, produced - acceptedVal);
    
    const formattedRejected = Number(rejectedVal.toFixed(3));
    setEditRejected(sanitizedValue === '' ? '' : String(formattedRejected));

    if (rejectedVal === 0) {
      setEditReason('');
    }
  };

  const handleSaveEdit = async () => {
    const acceptedVal = parseFloat(editAccepted || 0);
    const rejectedVal = parseFloat(editRejected || 0);
    const producedVal = parseFloat(selectedRecord.producedQty || 0);
    const scrapVal = parseFloat(editScrap || 0);

    if (editAccepted === '') {
      alert('Please enter accepted quantity');
      return;
    }

    if (acceptedVal < 0) {
      alert('Accepted quantity cannot be negative');
      return;
    }

    if (acceptedVal > producedVal) {
      alert(`Accepted quantity (${acceptedVal}) cannot exceed produced quantity (${producedVal})`);
      return;
    }

    if (rejectedVal > 0 && !editReason) {
      alert('Please select a rejection reason');
      return;
    }

    if (scrapVal < 0) {
      alert('Scrap quantity cannot be negative');
      return;
    }

    if (scrapVal > rejectedVal) {
      alert(`Scrap quantity (${scrapVal}) cannot exceed rejected quantity (${rejectedVal})`);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const payload = {
        acceptedQty: acceptedVal,
        rejectedQty: rejectedVal,
        rejectionReason: editReason || null,
        scrapQty: scrapVal,
        notes: editNotes
      };

      const response = await fetch(`${API_BASE}/job-cards/quality-logs/${selectedRecord.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccessMessage('Inspection record updated successfully');
        setTimeout(() => setSuccessMessage(''), 5000);
        setModalMode(null);
        setSelectedRecord(null);
        fetchQueue();
      } else {
        alert('Failed to update quality inspection record');
      }
    } catch (error) {
      console.error('Error updating quality inspection record:', error);
    }
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/quality-queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Map backend fields to UI fields
        const mappedData = data.map(item => ({
          id: item.id, // Log ID
          jobCardNo: item.jobId,
          date: formatDisplayDate(item.date),
          rawDate: item.date,
          dateShift: `${formatDisplayDate(item.date)} / SHIFT ${item.shift}`,
          operation: item.operation,
          producedQty: item.producedQty,
          accepted: item.acceptedQty || '',
          rejected: item.rejectedQty || '',
          reason: item.rejectionReason || '',
          status: item.status,
          notes: item.notes || '',
          scrapQty: item.scrapQty || '',
          rawShift: item.rawShift
        }));
        setRecords(mappedData);
      }
    } catch (error) {
      console.error('Error fetching quality queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleInputChange = (id, field, value) => {
    setRecords(prev => prev.map(record => {
      if (record.id === id) {
        let updatedRecord = { ...record, [field]: value };
        if (field === 'accepted') {
          // Allow only digits and a single decimal point
          const cleanValue = value.replace(/[^0-9.]/g, '');
          const parts = cleanValue.split('.');
          const sanitizedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanValue;
          
          updatedRecord.accepted = sanitizedValue;

          const produced = parseFloat(record.producedQty) || 0;
          const acceptedVal = sanitizedValue === '' ? 0 : (parseFloat(sanitizedValue) || 0);
          const rejectedVal = Math.max(0, produced - acceptedVal);
          
          const formattedRejected = Number(rejectedVal.toFixed(3));
          updatedRecord.rejected = sanitizedValue === '' ? '' : String(formattedRejected);
        }
        return updatedRecord;
      }
      return record;
    }));
  };

  const handleInspect = async (record) => {
    const acceptedVal = parseFloat(record.accepted || 0);
    const rejectedVal = parseFloat(record.rejected || 0);
    const producedVal = parseFloat(record.producedQty || 0);

    if (record.accepted === '') {
      alert('Please enter accepted quantity');
      return;
    }

    if (acceptedVal < 0) {
      alert('Accepted quantity cannot be negative');
      return;
    }

    if (acceptedVal > producedVal) {
      alert(`Accepted quantity (${acceptedVal}) cannot exceed produced quantity (${producedVal})`);
      return;
    }

    if (rejectedVal > 0 && !record.reason) {
      alert('Please select a rejection reason');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const payload = {
        acceptedQty: acceptedVal,
        rejectedQty: rejectedVal,
        rejectionReason: record.reason || null,
        status: 'APPROVED'
      };

      const response = await fetch(`${API_BASE}/job-cards/quality-logs/${record.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccessMessage('Quality inspection approved successfully');
        setTimeout(() => setSuccessMessage(''), 5000);
        fetchQueue();
      } else {
        alert('Failed to update quality inspection');
      }
    } catch (error) {
      console.error('Error updating quality inspection:', error);
    }
  };

  const handleDownloadReport = async (logId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/quality-logs/${logId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QC_Report_${logId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  const pendingRecords = records.filter(r => r.status === 'PENDING');
  const approvedRecords = records.filter(r => r.status === 'APPROVED');

  return (
    <div className="space-y-3 pb-8 text-xs">
      {/* Header */}
      <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <button className="p-1.5 hover:bg-slate-100 rounded transition-colors border border-slate-200">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">Quality & Rejection Entry</h1>
            <p className="text-xs  text-slate-500  mt-0.5">
              Production Output Queue
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 text-indigo-600  text-xs  hover:underline">
          <ChevronLeft className="w-2.5 h-2.5" /> Quality Control
        </button>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-100 rounded p-2 flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <p className="text-emerald-800 text-[11px] ">{successMessage}</p>
        </div>
      )}

      {/* Warning Alert */}
      {pendingRecords.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded p-2 flex gap-2.5">
          <div className="p-1 bg-white rounded-md shadow-sm h-fit">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900 leading-tight">Pending Job Requiring Quality Inspection!</h3>
            <p className="text-amber-800 text-[11px] mt-0.5 opacity-90">
              A job from production has been sent for quality inspection. Please review and enter results.
            </p>
          </div>
        </div>
      )}

      {/* TOP Section: Pending Requests */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-xs">
            <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded flex items-center justify-center text-xs ">1</span>
            Pending Quality Inspection Records
          </h3>
          <button 
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs  text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 "
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider">Job Card ID</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider">Date / Shift</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-center">Operation</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-center">Produced Qty</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-center w-24">Accepted</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-center w-24">Rejected</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-center">Reason</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-3 py-2 text-xs   text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2  text-slate-700">{record.jobCardNo}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs ">{record.dateShift}</td>
                  <td className="px-3 py-2 text-slate-600  text-center">{record.operation}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md  text-[11px] border border-slate-200">
                      {record.producedQty}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <input 
                      type="text"
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="0"
                      value={record.accepted}
                      onChange={(e) => handleInputChange(record.id, 'accepted', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input 
                      type="text"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-center outline-none cursor-not-allowed transition-all"
                      placeholder="0"
                      value={record.rejected}
                      readOnly
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select 
                      className="w-full px-1 py-1 bg-white border border-slate-200 rounded-md text-[11px] focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                      value={record.reason}
                      onChange={(e) => handleInputChange(record.id, 'reason', e.target.value)}
                    >
                      <option value="">Select Reason</option>
                      {rejectionReasons.map(reason => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={record.status} small />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDownloadReport(record.id)}
                        className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-[10px] hover:bg-slate-50 transition-all flex items-center gap-1"
                        title="Download QC Report"
                      >
                        <FileText className="w-3 h-3" />
                        QC Report
                      </button>
                      <button 
                        onClick={() => handleInspect(record)}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-md text-[10px]  hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Quality Approved
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingRecords.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" className="px-3 py-8 text-center text-slate-400 italic text-[11px]">
                    No pending quality inspection records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM Section: Approved Records */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-xs">
            <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded flex items-center justify-center text-xs ">2</span>
            Approved Inspection Records
          </h3>
          <div className="flex items-center gap-2 text-xs  text-slate-400">
            <History className="w-3 h-3" /> Recent History
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider">Job Card ID</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider">Operation</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Produced</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Accepted</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center text-rose-600">Rejected</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider">Reason</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvedRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors bg-emerald-50/10">
                  <td className="px-3 py-2  text-slate-700">{record.jobCardNo}</td>
                  <td className="px-3 py-2 text-slate-500">{record.date}</td>
                  <td className="px-3 py-2 text-slate-600 ">{record.operation}</td>
                  <td className="px-3 py-2 text-center text-slate-600 ">{record.producedQty}</td>
                  <td className="px-3 py-2 text-center text-emerald-600 ">{record.accepted}</td>
                  <td className="px-3 py-2 text-center text-rose-600 ">{record.rejected}</td>
                  <td className="px-3 py-2 text-slate-500 italic">{record.reason || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status="QC_CHECKED" small />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => openViewModal(record)}
                        className="px-2 py-1 bg-white border border-slate-200 text-indigo-600 rounded-md text-[10px] hover:bg-indigo-50 transition-all flex items-center gap-1"
                        title="View Details"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      <button 
                        onClick={() => openEditModal(record)}
                        className="px-2 py-1 bg-white border border-slate-200 text-amber-600 rounded-md text-[10px] hover:bg-amber-50 transition-all flex items-center gap-1"
                        title="Edit Record"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDownloadReport(record.id)}
                        className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-[10px] hover:bg-slate-50 transition-all flex items-center gap-1"
                        title="Download QC Report"
                      >
                        <FileText className="w-3 h-3" />
                        QC Report
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {approvedRecords.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" className="px-3 py-6 text-center text-slate-400 italic text-[11px]">
                    No approved records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {modalMode && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
          <div className="bg-white rounded border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-xs">
                {modalMode === 'view' ? 'Quality Inspection Details' : 'Edit Inspection Record'}
              </h3>
              <button 
                onClick={() => { setModalMode(null); setSelectedRecord(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors text-base font-bold leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 space-y-3 text-slate-700">
              {/* Job Card Summary */}
              <div className="bg-slate-50/50 p-2 rounded border border-slate-150 flex justify-between items-center text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block uppercase">Job Card ID</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.jobCardNo}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-medium block uppercase">Operation</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.operation}</span>
                </div>
              </div>

              {modalMode === 'view' ? (
                // VIEW MODE
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Date / Shift</span>
                    <span className="font-medium text-slate-800">{selectedRecord.dateShift}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Status</span>
                    <span className="inline-block mt-0.5">
                      <StatusBadge status={selectedRecord.status} small />
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Produced Qty</span>
                    <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                      {selectedRecord.producedQty}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <span className="text-slate-400 block">Accepted</span>
                      <span className="font-semibold text-emerald-600">{selectedRecord.accepted}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Rejected</span>
                      <span className="font-semibold text-rose-600">{selectedRecord.rejected}</span>
                    </div>
                  </div>
                  {parseFloat(selectedRecord.rejected || 0) > 0 && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Rejection Reason</span>
                      <span className="font-medium text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded block mt-0.5">
                        {selectedRecord.reason}
                      </span>
                    </div>
                  )}
                  {selectedRecord.scrapQty !== '' && parseFloat(selectedRecord.scrapQty || 0) > 0 && (
                    <div>
                      <span className="text-slate-400 block">Scrap Qty</span>
                      <span className="font-medium text-orange-600">{selectedRecord.scrapQty}</span>
                    </div>
                  )}
                  {selectedRecord.notes && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Notes / Remarks</span>
                      <p className="bg-slate-50 p-2 rounded border border-slate-100 mt-1 whitespace-pre-wrap text-slate-600">
                        {selectedRecord.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // EDIT MODE
                <div className="space-y-2.5 text-[11px]">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5">Produced</label>
                      <input 
                        type="text"
                        className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded text-center cursor-not-allowed outline-none font-medium text-slate-600 text-[11px]"
                        value={selectedRecord.producedQty}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Accepted</label>
                      <input 
                        type="text"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-center focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-semibold text-emerald-600 text-[11px]"
                        value={editAccepted}
                        onChange={(e) => handleEditAcceptedChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Rejected</label>
                      <input 
                        type="text"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center cursor-not-allowed outline-none font-semibold text-rose-600 text-[11px]"
                        value={editRejected}
                        readOnly
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-0.5">Rejection Reason</label>
                    <select 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer text-[11px]"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      disabled={parseFloat(editRejected || 0) === 0}
                    >
                      <option value="">Select Reason</option>
                      {rejectionReasons.map(reason => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-0.5">Scrap Qty</label>
                    <input 
                      type="text"
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-[11px]"
                      placeholder="0"
                      value={editScrap}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^0-9.]/g, '');
                        setEditScrap(cleanValue);
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-0.5">Notes / Remarks</label>
                    <textarea 
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none h-14 resize-none text-[11px]"
                      placeholder="Enter inspection remarks..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1.5">
              <button 
                onClick={() => { setModalMode(null); setSelectedRecord(null); }}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-[10px] transition-colors"
              >
                Close
              </button>
              {modalMode === 'view' ? (
                <button 
                  onClick={() => handleDownloadReport(selectedRecord.id)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] transition-colors flex items-center gap-1 shadow-sm"
                >
                  <FileText className="w-3 h-3" />
                  QC Report
                </button>
              ) : (
                <button 
                  onClick={handleSaveEdit}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] transition-colors flex items-center gap-1 shadow-sm"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default QualityRejectionEntry;
