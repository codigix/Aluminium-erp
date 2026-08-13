import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Inbox, CheckCircle2, Package, Truck, 
  ArrowLeft, Printer, Download, Search, AlertCircle, Eye, 
  CheckCircle, XCircle, Clock, ChevronRight, Filter, RotateCcw,
  User, Users, Box, ClipboardList, Info, FileSpreadsheet, Paperclip
} from 'lucide-react';
import { Card, StatusBadge, Button, Skeleton, SkeletonCard, SkeletonTable } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const QCGrnDetails = () => {
  const { grnId: paramGrnId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract ID from URL if not available in params (for manual routing)
  const segments = location.pathname.split('/').filter(Boolean);
  const grnId = paramGrnId || segments[segments.length - 1];
  
  const [activeTab, setActiveTab] = useState('GRN Details');
  const [loading, setLoading] = useState(true);
  const [grnData, setGrnData] = useState(null);
  const [grnItems, setGrnItems] = useState([]);
  const [qcInspections, setQcInspections] = useState([]);
  const [rejections, setRejections] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [inspectionFilter, setInspectionFilter] = useState('All');
  const [searchQuery, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [grnId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Fetch GRN Details
      const grnRes = await fetch(`${API_BASE}/grns/${grnId}`, { headers });
      if (!grnRes.ok) throw new Error('Failed to fetch GRN');
      const grn = await grnRes.json();
      setGrnData(grn);

      // 2. Fetch GRN Items
      const itemsRes = await fetch(`${API_BASE}/grn-items/${grnId}/details`, { headers });
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setGrnItems(data.items || []);
      }

      // 3. Fetch QC Inspections for this GRN
      const qcRes = await fetch(`${API_BASE}/qc-inspections`, { headers });
      if (qcRes.ok) {
        const allQcs = await qcRes.json();
        const grnQcs = allQcs.filter(qc => String(qc.grn_id) === String(grnId));
        
        // Fetch items and attachments for each inspection
        const detailedQcs = await Promise.all(grnQcs.map(async (qc) => {
            const itemsRes = await fetch(`${API_BASE}/qc-inspections/${qc.id}`, { headers });
            const attachRes = await fetch(`${API_BASE}/qc-inspections/${qc.id}/attachments`, { headers });
            
            let qcData = { ...qc };
            if (itemsRes.ok) {
                const detailed = await itemsRes.json();
                qcData = { ...qcData, ...detailed };
            }
            if (attachRes.ok) {
                const attachData = await attachRes.json();
                qcData.attachments = attachData;
            }
            return qcData;
        }));
        
        setQcInspections(detailedQcs);
        
        // Extract all rejections and attachments
        const allRejections = detailedQcs.flatMap(qc => 
            (qc.items || []).filter(item => parseFloat(item.rejected_qty) > 0)
        );
        setRejections(allRejections);

        const allAttachments = detailedQcs.flatMap(qc => qc.attachments || []);
        setAttachments(allAttachments);
      }

    } catch (error) {
      console.error('Error fetching QC GRN details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!qcInspections || qcInspections.length === 0) return;
    const qcId = qcInspections[0].id;
    try {
      setDownloading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QC_Report_${qcId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPDF = async () => {
    if (!qcInspections || qcInspections.length === 0) return;
    const qcId = qcInspections[0].id;
    try {
      setPrinting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/qc-inspections/${qcId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      } else {
        throw new Error('Failed to print PDF');
      }
    } catch (error) {
      console.error('Error printing PDF:', error);
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="h-6 bg-slate-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="bg-white rounded border border-slate-100 p-4">
          <SkeletonTable rows={4} columns={5} />
        </div>
      </div>
    );
  }

  if (!grnData) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">GRN Not Found</h2>
        <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const tabs = [
    { label: 'GRN Details', value: 'GRN Details', count: null },
    { label: 'QC Inspections', value: 'QC Inspections', count: qcInspections.length },
    { label: 'Rejections', value: 'Rejections', count: rejections.length }
  ];

  const totalReceived = grnItems.reduce((sum, item) => sum + parseFloat(item.received_qty || 0), 0);
  const totalAccepted = grnItems.reduce((sum, item) => sum + parseFloat(item.accepted_qty || 0), 0);
  const totalRejected = grnItems.reduce((sum, item) => sum + parseFloat(item.rejected_qty || 0), 0);

  const overallStatus = qcInspections.some(qc => qc.status === 'FAILED' || qc.status === 'QC_REJECTED') ? 'Failed' : 
                       qcInspections.length > 0 ? 'Passed' : 'Pending';
  
  const overallRemarks = qcInspections.length > 0 ? qcInspections[0].remarks : 'No inspections recorded yet.';

  const filteredGrnItems = grnItems.filter(item => {
    const matchesSearch = 
      item.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = inspectionFilter === 'All' || 
      (inspectionFilter === 'Accepted' && (item.status === 'APPROVED' || item.status === 'ACCEPTED')) ||
      (inspectionFilter === 'Rejected' && (parseFloat(item.rejected_qty) > 0));

    return matchesSearch && matchesStatus;
  });

  const renderGRNDetails = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
      <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">GRN Items & QC Inspection Details</h3>
            <div className="flex gap-2">
                <select 
                  className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                  value={inspectionFilter}
                  onChange={(e) => setInspectionFilter(e.target.value)}
                >
                    <option value="All">All Inspection Status</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                </select>
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by item code / description..." 
                        className="pl-8 pr-3 py-1 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="p-3">#</th>
                        <th className="p-3">Item Details</th>
                        <th className="p-3 text-center">Design Qty (PO)</th>
                        <th className="p-3 text-center">Received Qty</th>
                        <th className="p-3 text-center">Accepted Qty</th>
                        <th className="p-3 text-center">Rejected Qty</th>
                        <th className="p-3">Unit</th>
                        <th className="p-3">QC Status</th>
                        <th className="p-3">Inspection Date</th>
                        <th className="p-3">Inspected By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredGrnItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-[11px]">
                            <td className="p-3 text-slate-400">{idx + 1}</td>
                            <td className="p-3">
                                <p className="font-bold text-slate-900">{item.item_code}</p>
                                <p className="text-slate-500">{item.material_name || item.description}</p>
                                <p className="text-[9px] text-slate-400">Specification: IS 2062 Gr. B</p>
                            </td>
                            <td className="p-3 text-center font-medium text-slate-900">{parseFloat(item.po_qty || 0).toFixed(3)}</td>
                            <td className="p-3 text-center font-medium text-slate-900">{parseFloat(item.received_qty || 0).toFixed(3)}</td>
                            <td className="p-3 text-center font-bold text-emerald-600">{parseFloat(item.accepted_qty || 0).toFixed(3)}</td>
                            <td className="p-3 text-center font-bold text-rose-600">{parseFloat(item.rejected_qty || 0).toFixed(3)}</td>
                            <td className="p-3 text-slate-500">{item.unit || 'NOS'}</td>
                            <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    item.status === 'APPROVED' || item.status === 'ACCEPTED' 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                                }`}>
                                    {item.status || 'Accepted'}
                                </span>
                            </td>
                            <td className="p-3 text-slate-500">{formatDateTime(item.updated_at)}</td>
                            <td className="p-3 text-slate-500">
                                <p className="font-medium">Authorized Inspector</p>
                                <p className="text-[9px]">(QA Department)</p>
                            </td>
                        </tr>
                    ))}
                    {filteredGrnItems.length > 0 && (
                        <tr className="bg-slate-50/50 font-bold text-[11px] text-slate-900">
                            <td colSpan={2} className="p-3">Total</td>
                            <td className="p-3 text-center">{filteredGrnItems.reduce((s, i) => s + parseFloat(i.po_qty || 0), 0).toFixed(3)}</td>
                            <td className="p-3 text-center">{filteredGrnItems.reduce((s, i) => s + parseFloat(i.received_qty || 0), 0).toFixed(3)}</td>
                            <td className="p-3 text-center text-emerald-600">{filteredGrnItems.reduce((s, i) => s + parseFloat(i.accepted_qty || 0), 0).toFixed(3)}</td>
                            <td className="p-3 text-center text-rose-600">{filteredGrnItems.reduce((s, i) => s + parseFloat(i.rejected_qty || 0), 0).toFixed(3)}</td>
                            <td colSpan={4}></td>
                        </tr>
                    )}
                    {filteredGrnItems.length === 0 && (
                        <tr>
                            <td colSpan={10} className="p-8 text-center text-slate-400 italic">No items matching current filters.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-50">
                  <h3 className="font-semibold text-slate-800 text-sm">Quality Inspection Summary</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400">Total Items</p>
                          <p className="text-sm font-bold text-slate-900">{grnItems.length}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400">Total Received Qty</p>
                          <p className="text-sm font-bold text-slate-900">{totalReceived.toFixed(3)}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400">Total Accepted Qty</p>
                          <p className="text-sm font-bold text-slate-900">{totalAccepted.toFixed(3)}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400">Total Rejected Qty</p>
                          <p className="text-sm font-bold text-slate-900">{totalRejected.toFixed(3)}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400">Inspection Completed On</p>
                          <p className="text-xs font-bold text-slate-900">{qcInspections.length > 0 ? formatDateTime(qcInspections[0].inspection_date) : formatDateTime(grnData.updated_at)}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                          <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400">Inspected By</p>
                          <p className="text-xs font-bold text-slate-900">Authorized Inspector</p>
                      </div>
                  </div>
              </div>
          </Card>

          <div className="space-y-4">
              <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm h-fit">
                  <div className="p-3 border-b border-slate-50">
                      <h3 className="font-semibold text-slate-800 text-sm">Overall Remarks</h3>
                  </div>
                  <div className="p-4">
                      <p className="text-xs text-indigo-600 font-medium">{overallRemarks || 'All items verified and accepted as per Purchase Order specifications.'}</p>
                  </div>
              </Card>

              <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800 text-sm">Attachments</h3>
                  </div>
                  <div className="p-3 space-y-2">
                      {attachments.length > 0 ? attachments.map((file, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between p-2 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-rose-50 flex items-center justify-center">
                                      <FileSpreadsheet className="w-4 h-4 text-rose-600" />
                                  </div>
                                  <div>
                                      <p className="text-[11px] font-medium text-slate-700">{file.file_name}</p>
                                      <p className="text-[9px] text-slate-400">QC Attachment</p>
                                  </div>
                              </div>
                              <button 
                                onClick={() => {
                                  const token = localStorage.getItem('authToken');
                                  const url = file.file_url.startsWith('http') ? file.file_url : `${API_BASE}/${file.file_url}`;
                                  window.open(url, '_blank');
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                  <Download className="w-4 h-4" />
                              </button>
                          </div>
                      )) : (
                        <div className="text-center py-4">
                            <Paperclip className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-[10px] text-slate-400">No attachments found</p>
                        </div>
                      )}
                  </div>
              </Card>
          </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4 bg-slate-50/50 min-h-screen">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2">
        <span className="hover:text-indigo-600 cursor-pointer" onClick={() => navigate('/quality/quality-dashboard')}>Quality</span>
        <ChevronRight className="w-3 h-3" />
        <span className="hover:text-indigo-600 cursor-pointer" onClick={() => navigate('/quality/quality-reports')}>QC Reports</span>
        <ChevronRight className="w-3 h-3" />
        <span className="hover:text-indigo-600 cursor-pointer">GRN Details</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 font-medium">GRN-{String(grnData.id).padStart(4, '0')}</span>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900">Goods Receipt (GRN) Details</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                {grnData.status || 'Received'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Quality Reports &gt; QC Details &gt; {grnData.poNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="h-9 gap-2 text-xs font-semibold bg-white"
            onClick={handlePrintPDF}
            disabled={printing || qcInspections.length === 0}
          >
            <Printer className={`w-4 h-4 ${printing ? 'animate-pulse' : ''}`} />
            {printing ? 'Printing...' : 'Print'}
          </Button>
          <Button 
            variant="outline" 
            className="h-9 gap-2 text-xs font-semibold bg-white"
            onClick={handleDownloadPDF}
            disabled={downloading || qcInspections.length === 0}
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            {downloading ? 'Downloading...' : 'Download (PDF)'}
          </Button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <Button variant="ghost" className="w-9 h-9 p-0 hover:bg-white border border-transparent hover:border-slate-100">
            <AlertCircle className="w-5 h-5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Top Cards Section */}
      <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-50">
          <div className="p-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">GRN Number</p>
            <p className="text-sm font-bold text-blue-600">GRN-{String(grnData.id).padStart(4, '0')}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">GRN Date</p>
            <p className="text-xs font-bold text-slate-900">{formatDate(grnData.grnDate)}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">PO Number</p>
            <p className="text-xs font-bold text-blue-600">{grnData.poNumber}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2 text-center">Supplier</p>
            <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-slate-900">{grnData.vendorName}</p>
                <span className="px-2 py-0.5 rounded-[4px] text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 uppercase">Active Supplier</span>
                <div className="mt-3 text-center">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Address</p>
                    <p className="text-[10px] text-slate-500 font-medium">{grnData.supplier_address || grnData.vendorAddress || 'No address provided'}</p>
                </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Received By</p>
            <p className="text-xs font-bold text-slate-900">{grnData.receivedBy || 'Warehouse Incharge'}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Warehouse</p>
            <p className="text-xs font-bold text-slate-900">{grnData.warehouse_name || 'Main Warehouse'}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Received As Per</p>
            <p className="text-xs font-bold text-slate-900">PO Qty</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Received By User</p>
            <p className="text-xs font-bold text-slate-900">{grnData.received_by_user || 'Ramesh Patil'}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">QC Inspection Status</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                overallStatus === 'Passed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                overallStatus === 'Failed' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 
                'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
                {overallStatus}
            </span>
            <div className="mt-4">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Overall Remarks</p>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{overallRemarks || 'All items verified and accepted.'}</p>
            </div>
          </div>
          <div className="p-4 bg-slate-50/30">
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Items</p>
                    <p className="text-sm font-bold text-slate-900">{grnItems.length}</p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Received Qty</p>
                    <p className="text-sm font-bold text-slate-900">{totalReceived.toFixed(3)}</p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-emerald-600">Total Accepted Qty</p>
                    <p className="text-sm font-bold text-emerald-600">{totalAccepted.toFixed(3)}</p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-rose-600">Total Rejected Qty</p>
                    <p className="text-sm font-bold text-rose-600">{totalRejected.toFixed(3)}</p>
                </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 mb-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-6 py-3 text-xs font-bold transition-all relative ${
              activeTab === tab.value 
                ? 'text-rose-600 border-b-2 border-rose-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.value ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                }`}>
                    {tab.count}
                </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'GRN Details' && renderGRNDetails()}
      {activeTab === 'QC Inspections' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="p-3">Inspection ID</th>
                                <th className="p-3">Date</th>
                                <th className="p-3 text-center">Items</th>
                                <th className="p-3 text-center">Pass Qty</th>
                                <th className="p-3 text-center">Fail Qty</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {qcInspections.map((qc, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-[11px]">
                                    <td className="p-3 font-bold text-blue-600">QC-{String(qc.id).padStart(4, '0')}</td>
                                    <td className="p-3 text-slate-500">{formatDateTime(qc.inspection_date)}</td>
                                    <td className="p-3 text-center font-medium text-slate-900">{qc.items?.length || 0}</td>
                                    <td className="p-3 text-center font-bold text-emerald-600">{parseFloat(qc.pass_quantity || 0).toFixed(3)}</td>
                                    <td className="p-3 text-center font-bold text-rose-600">{parseFloat(qc.fail_quantity || 0).toFixed(3)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                            qc.status === 'PASSED' || qc.status === 'QC_APPROVED' 
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                                        }`}>
                                            {qc.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-500 truncate max-w-[200px]">{qc.remarks || '—'}</td>
                                </tr>
                            ))}
                            {qcInspections.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">No inspection records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
      )}
      {activeTab === 'Rejections' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
            <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="p-3">#</th>
                                <th className="p-3">Item Details</th>
                                <th className="p-3 text-center">Rejected Qty</th>
                                <th className="p-3">Unit</th>
                                <th className="p-3">Reason / Remarks</th>
                                <th className="p-3">Warehouse</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {rejections.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group text-[11px]">
                                    <td className="p-3 text-slate-400">{idx + 1}</td>
                                    <td className="p-3">
                                        <p className="font-bold text-slate-900">{item.item_code}</p>
                                        <p className="text-slate-500">{item.material_name || item.description}</p>
                                    </td>
                                    <td className="p-3 text-center font-bold text-rose-600">{parseFloat(item.rejected_qty || 0).toFixed(3)}</td>
                                    <td className="p-3 text-slate-500">{item.unit || 'NOS'}</td>
                                    <td className="p-3 text-slate-500">{item.remarks || 'Quality deviation detected.'}</td>
                                    <td className="p-3 text-slate-500">{item.warehouse_name || 'Main Warehouse'}</td>
                                </tr>
                            ))}
                            {rejections.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400 italic">No rejections found for this GRN.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
      )}
    </div>
  );
};

export default QCGrnDetails;
