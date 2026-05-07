import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Inbox, CheckCircle2, Package, Truck, 
  ArrowLeft, Printer, Download, Search, AlertCircle, Eye, 
  CheckCircle, XCircle, Clock, ChevronRight, Filter, RotateCcw,
  User, Users, Box, ClipboardList, Info, FileSpreadsheet, Paperclip
} from 'lucide-react';
import { Card, StatusBadge, Button } from '../components/ui.jsx';

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
        const grnQcs = allQcs.filter(qc => qc.grn_id === parseInt(grnId));
        
        // Fetch items for each inspection to count them or show details
        const detailedQcs = await Promise.all(grnQcs.map(async (qc) => {
            const itemsRes = await fetch(`${API_BASE}/qc-inspections/${qc.id}`, { headers });
            if (itemsRes.ok) {
                return await itemsRes.json();
            }
            return qc;
        }));
        
        setQcInspections(detailedQcs);
        
        // Extract rejections
        const allRejections = detailedQcs.flatMap(qc => 
            (qc.items || []).filter(item => parseFloat(item.rejected_qty) > 0)
        );
        setRejections(allRejections);
      }

    } catch (error) {
      console.error('Error fetching QC GRN details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-600 rounded animate-spin" />
        <h3 className="text-slate-900 font-medium">Loading Details...</h3>
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

  const renderGRNDetails = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
      <Card className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">GRN Items & QC Inspection Details</h3>
            <div className="flex gap-2">
                <select className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500">
                    <option>All Inspection Status</option>
                    <option>Accepted</option>
                    <option>Rejected</option>
                </select>
                <select className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500">
                    <option>All Item Status</option>
                </select>
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by item code / description..." 
                        className="pl-8 pr-3 py-1 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 w-64"
                    />
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    QC Inspection
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 h-8">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Re-Inspect
                </Button>
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
                        <th className="p-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {grnItems.map((item, idx) => (
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
                                    item.status === 'Approved ' || item.status === 'ACCEPTED' 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                                }`}>
                                    {item.status || 'Accepted'}
                                </span>
                            </td>
                            <td className="p-3 text-slate-500">{formatDateTime(item.updated_at)}</td>
                            <td className="p-3 text-slate-500">
                                <p className="font-medium">Ramesh Patil</p>
                                <p className="text-[9px]">(QA Inspector)</p>
                            </td>
                            <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-all border border-transparent hover:border-blue-100">
                                        <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-md transition-all border border-transparent hover:border-slate-200">
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {grnItems.length > 0 && (
                        <tr className="bg-slate-50/50 font-bold text-[11px] text-slate-900">
                            <td colSpan={2} className="p-3">Total</td>
                            <td className="p-3 text-center">{grnItems.reduce((s, i) => s + parseFloat(i.po_qty || 0), 0).toFixed(3)}</td>
                            <td className="p-3 text-center">{totalReceived.toFixed(3)}</td>
                            <td className="p-3 text-center text-emerald-600">{totalAccepted.toFixed(3)}</td>
                            <td className="p-3 text-center text-rose-600">{totalRejected.toFixed(3)}</td>
                            <td colSpan={5}></td>
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
                          <p className="text-xs font-bold text-slate-900">Ramesh Patil (QA Inspector)</p>
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
                      <div className="flex items-center justify-between p-2 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-rose-50 flex items-center justify-center">
                                  <FileSpreadsheet className="w-4 h-4 text-rose-600" />
                              </div>
                              <div>
                                  <p className="text-[11px] font-medium text-slate-700">inspection_report_GRN-2026-0012.pdf</p>
                                  <p className="text-[9px] text-slate-400">245 KB</p>
                              </div>
                          </div>
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                              <Download className="w-4 h-4" />
                          </button>
                      </div>
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
        <span className="hover:text-indigo-600 cursor-pointer" onClick={() => navigate('/quality-dashboard')}>Quality</span>
        <ChevronRight className="w-3 h-3" />
        <span className="hover:text-indigo-600 cursor-pointer" onClick={() => navigate('/quality-reports')}>QC Reports</span>
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
              Quality Reports > QC Details > {grnData.poNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 gap-2 text-xs font-semibold bg-white">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="outline" className="h-9 gap-2 text-xs font-semibold bg-white">
            <Download className="w-4 h-4" />
            Download (PDF)
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
                    <p className="text-[10px] text-slate-500 font-medium">Gokul Nagar, Katraj, Pune - 411048</p>
                </div>
                <Button size="sm" variant="outline" className="mt-3 h-7 text-[10px] gap-1.5 px-3">
                    <User className="w-3 h-3" />
                    View Supplier
                </Button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Received By</p>
            <p className="text-xs font-bold text-slate-900">Warehouse Incharge</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Warehouse</p>
            <p className="text-xs font-bold text-slate-900">Main Warehouse</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Received As Per</p>
            <p className="text-xs font-bold text-slate-900">PO Qty</p>
            <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Received By User</p>
            <p className="text-xs font-bold text-slate-900">Ramesh Patil</p>
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
            <Button size="sm" variant="outline" className="mt-6 h-8 text-xs gap-1.5 w-full">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                View QC History
            </Button>
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
        <div className="p-8 text-center bg-white rounded-xl border border-slate-100 shadow-sm">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">QC Inspections List</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Multiple inspection records are consolidated in the main details view.</p>
        </div>
      )}
      {activeTab === 'Rejections' && (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-100 shadow-sm">
            <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">No Rejections Recorded</h3>
            <p className="text-xs text-slate-500 mt-1">All items passed the quality inspection criteria.</p>
        </div>
      )}
    </div>
  );
};

export default QCGrnDetails;
