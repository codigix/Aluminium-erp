import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Save,
  Check,
  History,
  FileText
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
          dateShift: `${formatDisplayDate(item.date)} / SHIFT ${item.shift}`,
          operation: item.operation,
          producedQty: item.producedQty,
          accepted: item.acceptedQty || '',
          rejected: item.rejectedQty || '',
          reason: item.rejectionReason || '',
          status: item.status
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
    setRecords(prev => prev.map(record => 
      record.id === id ? { ...record, [field]: value } : record
    ));
  };

  const handleInspect = async (record) => {
    if (record.accepted === '' && record.rejected === '') {
      alert('Please enter accepted or rejected quantity');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const payload = {
        acceptedQty: parseFloat(record.accepted || 0),
        rejectedQty: parseFloat(record.rejected || 0),
        rejectionReason: record.reason,
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
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              Production Output Queue
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 text-indigo-600 font-medium text-[10px] hover:underline">
          <ChevronLeft className="w-2.5 h-2.5" /> Quality Control
        </button>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-100 rounded p-2 flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <p className="text-emerald-800 text-[11px] font-medium">{successMessage}</p>
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
            <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
            Pending Quality Inspection Records
          </h3>
          <button 
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-[10px] text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider">Job Card ID</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider">Date / Shift</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Operation</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Produced Qty</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center w-24">Accepted</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center w-24">Rejected</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Reason</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-3 py-2 text-[10px]  text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-700">{record.jobCardNo}</td>
                  <td className="px-3 py-2 text-slate-500 text-[10px]">{record.dateShift}</td>
                  <td className="px-3 py-2 text-slate-600 font-medium text-center">{record.operation}</td>
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
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="0"
                      value={record.rejected}
                      onChange={(e) => handleInputChange(record.id, 'rejected', e.target.value)}
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
            <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
            Approved Inspection Records
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
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
                  <td className="px-3 py-2 font-medium text-slate-700">{record.jobCardNo}</td>
                  <td className="px-3 py-2 text-slate-500">{record.date}</td>
                  <td className="px-3 py-2 text-slate-600 font-medium">{record.operation}</td>
                  <td className="px-3 py-2 text-center text-slate-600 ">{record.producedQty}</td>
                  <td className="px-3 py-2 text-center text-emerald-600 ">{record.accepted}</td>
                  <td className="px-3 py-2 text-center text-rose-600 ">{record.rejected}</td>
                  <td className="px-3 py-2 text-slate-500 italic">{record.reason || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={record.status} small />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button 
                      onClick={() => handleDownloadReport(record.id)}
                      className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-[10px] hover:bg-slate-50 transition-all flex items-center gap-1 ml-auto"
                      title="Download QC Report"
                    >
                      <FileText className="w-3 h-3" />
                      QC Report
                    </button>
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

    </div>
  );
};

export default QualityRejectionEntry;
