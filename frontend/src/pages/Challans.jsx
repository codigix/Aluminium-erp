import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, DataTable, StatusBadge, Modal, FormControl, Tabs, Button } from '../components/ui.jsx';
import { Truck, Package, Eye, Search, Filter, Calendar, User, Building2, ClipboardList, ArrowRight, Download, FileText, CheckCircle, Send, History, Upload, ChevronDown, Trash2, Plus } from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const Challans = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDeptPrefix = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefixes = ['sales', 'design', 'production', 'procurement', 'inventory', 'quality', 'shipment', 'accounts', 'hr', 'admin'];
    return prefixes.includes(segments[0]) ? `/${segments[0]}` : '';
  };
  const deptPrefix = getDeptPrefix();

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('outward');
  const [outwardChallans, setOutwardChallans] = useState([]);
  const [inwardChallans, setInwardChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [items, setItems] = useState([]);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/items?includeAll=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const [outwardFormData, setOutwardFormData] = useState({
    vendorId: '',
    operationName: '',
    plannedQty: 0,
    expectedReturnDate: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    dispatchQty: 0,
    dispatchNotes: '',
    materialItems: []
  });

  const fetchOutwardChallanDetails = async (challanId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/outward-challans/${challanId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const challan = await response.json();
        setOutwardFormData({
          vendorId: challan.vendor_id || '',
          operationName: challan.operation_name || '',
          plannedQty: challan.planned_qty || 0,
          expectedReturnDate: challan.expected_return_date ? challan.expected_return_date.split('T')[0] : '',
          dispatchDate: challan.dispatch_date ? challan.dispatch_date.split('T')[0] : new Date().toISOString().split('T')[0],
          dispatchQty: challan.dispatch_qty || 0,
          dispatchNotes: challan.notes || '',
          materialItems: (challan.items || []).map(item => ({
            itemCode: item.item_code,
            requiredQty: item.required_qty,
            releaseQty: item.release_qty
          }))
        });
      }
    } catch (error) {
      console.error('Error fetching outward challan details:', error);
    }
  };

  useEffect(() => {
    const isOutward = location.pathname.includes('/outward');
    const isInward = location.pathname.includes('/inward');
    const id = searchParams.get('id');
    const action = location.pathname.split('/').pop();

    if (isOutward) {
      setActiveTab('outward');
    } else if (isInward) {
      setActiveTab('inward');
    }

    if (action === 'details' && id) {
      if (activeTab === 'inward') {
        const challan = inwardChallans.find(c => String(c.id) === String(id));
        if (challan) {
          setSelectedChallan(challan);
          setIsViewMode(true);
          fetchInwardItems(challan.job_card_id);
          setIsInwardModalOpen(true);
        }
      } else {
        const challan = outwardChallans.find(c => String(c.id) === String(id));
        if (challan) {
          setSelectedChallan(challan);
          setIsViewMode(true);
          fetchOutwardChallanDetails(challan.id);
          setIsViewModalOpen(true);
        }
      }
    } else if (action === 'record-inward' && id) {
      const challan = outwardChallans.find(c => String(c.id) === String(id));
      if (challan && challan.status === 'DISPATCHED') {
        setSelectedChallan(challan);
        setIsViewMode(false);
        setInwardFormData({
          receivedQty: challan.dispatch_qty,
          acceptedQty: challan.dispatch_qty,
          rejectedQty: 0,
          scrapQty: 0,
          remarks: '',
          receivedDate: new Date().toISOString().split('T')[0],
          inwardItems: [],
          vendorInvoice: null
        });
        fetchInwardItems(challan.job_card_id);
        setIsInwardModalOpen(true);
      }
    } else {
      setIsViewModalOpen(false);
      setIsInwardModalOpen(false);
    }
  }, [location.pathname, searchParams, outwardChallans, inwardChallans, activeTab]);

  const handleTabChange = (tab) => {
    navigate(`${deptPrefix}/sub-contract-challans/${tab}`);
  };
  const [inwardFormData, setInwardFormData] = useState({
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    remarks: '',
    receivedDate: new Date().toISOString().split('T')[0],
    inwardItems: [],
    vendorInvoice: null
  });

  const fetchInwardItems = async (jobCardId) => {
    try {
      const token = localStorage.getItem('authToken');
      
      // 1. Fetch original outward items
      const response = await fetch(`${API_BASE}/outward-challans/job-card/${jobCardId}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // 2. Fetch existing inward challan from new endpoint
      const inwardRes = await fetch(`${API_BASE}/outward-challans/inward/job-card/${jobCardId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const outwardItems = await response.json();
        let existingInwardItems = [];
        let existingInward = null;

        if (inwardRes.ok) {
          existingInward = await inwardRes.json();
          existingInwardItems = existingInward.items || [];
        }

        // Map rates and release_qty from existing record if found, otherwise default to 0
        const itemsWithRate = outwardItems.map(item => {
          const matched = existingInwardItems.find(ei => ei.item_code === item.item_code);
          return {
            ...item,
            release_qty: matched ? matched.received_qty : (parseFloat(item.release_qty) || parseFloat(item.required_qty) || 0),
            rate: matched ? matched.rate : 0
          };
        });

        setInwardFormData(prev => ({
          ...prev,
          inwardItems: itemsWithRate,
          receivedDate: existingInward ? existingInward.received_date.split('T')[0] : prev.receivedDate,
          remarks: existingInward ? (existingInward.notes || '') : prev.remarks,
          acceptedQty: existingInward ? existingInward.total_received_qty : prev.acceptedQty,
          receivedQty: existingInward ? existingInward.total_received_qty : prev.receivedQty,
          rejectedQty: existingInward ? 0 : 0,
          scrapQty: existingInward ? 0 : 0
        }));
      }
    } catch (error) {
      console.error('Error fetching inward items:', error);
    }
  };

  const handleVendorInward = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const payload = {
        outwardChallanId: activeTab === 'outward' ? selectedChallan.id : selectedChallan.outward_challan_id,
        jobCardId: selectedChallan.job_card_id,
        vendorId: selectedChallan.vendor_id,
        receivedDate: inwardFormData.receivedDate,
        vendorInvoiceNo: inwardFormData.remarks,
        totalReceivedQty: inwardFormData.receivedQty,
        acceptedQty: inwardFormData.acceptedQty,
        rejectedQty: inwardFormData.rejectedQty,
        scrapQty: inwardFormData.scrapQty,
        notes: inwardFormData.remarks,
        items: inwardFormData.inwardItems.map(item => ({
          itemCode: item.item_code,
          receivedQty: item.release_qty,
          acceptedQty: item.release_qty,
          rejectedQty: 0,
          scrapQty: 0,
          rate: item.rate
        }))
      };

      const response = await fetch(`${API_BASE}/outward-challans/inward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        successToast('Vendor Receipt recorded successfully');
        setIsInwardModalOpen(false);
        navigate(`${deptPrefix}/sub-contract-challans/outward`);
        fetchChallans();
      } else {
        errorToast('Failed to record vendor receipt');
      }
    } catch (error) {
      console.error('Error recording vendor receipt:', error);
      errorToast('Error recording vendor receipt');
    }
  };

  useEffect(() => {
    fetchChallans();
    fetchItems();
  }, [activeTab]);

  const handleDownloadPDF = async (challanId, challanNumber) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/outward-challans/${challanId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Outward_Challan_${challanNumber}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        successToast('PDF download started');
      } else {
        errorToast('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      errorToast('Error downloading PDF');
    }
  };

  const fetchChallans = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const endpoint = activeTab === 'outward' ? '/outward-challans' : '/outward-challans/inward';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (activeTab === 'outward') {
        setOutwardChallans(Array.isArray(data) ? data : []);
      } else {
        setInwardChallans(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      errorToast('Failed to fetch challans');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const outwardColumns = [
    { label: 'Challan No', key: 'challan_number', className: ' text-indigo-600' },
    { label: 'Job Card', key: 'job_card_no' },
    { label: 'Vendor', key: 'vendor_name' },
    { label: 'Operation', key: 'operation_name' },
    { label: 'Dispatch Qty', key: 'dispatch_qty', render: (val) => `${parseFloat(val || 0).toFixed(2)} units` },
    { label: 'Dispatch Date', key: 'dispatch_date', render: (val) => formatDate(val) },
    { label: 'Status', key: 'status', render: (val) => (
      <StatusBadge 
        status={val === 'RECEIVED' ? 'APPROVED' : (val === 'DISPATCHED' ? 'IN_PROGRESS' : 'PENDING')} 
        text={val} 
      />
    )},
    { label: 'Actions', key: 'id', className: 'text-right', render: (_, row) => (
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => { navigate(`${deptPrefix}/sub-contract-challans/${activeTab}/details?id=${row.id}`); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="View Details">
          <Eye className="w-4 h-4" />
        </button>
        <button 
          onClick={() => handleDownloadPDF(row.id, row.challan_number)} 
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" 
          title="Download PDF"
        >
          <Download className="w-4 h-4" />
        </button>
        {row.status === 'DISPATCHED' && (
          <button 
            onClick={() => {
              navigate(`${deptPrefix}/sub-contract-challans/outward/record-inward?id=${row.id}`);
            }} 
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
            title="Record Inward Receipt"
          >
            <Package className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  ];

  const inwardColumns = [
    { label: 'Inward No', key: 'inward_number', className: ' text-emerald-600' },
    { label: 'Outward Ref', key: 'outward_challan_no' },
    { label: 'Job Card', key: 'job_card_no' },
    { label: 'Vendor', key: 'vendor_name' },
    { label: 'Received Qty', key: 'total_received_qty', render: (val) => `${parseFloat(val || 0).toFixed(2)} units` },
    { label: 'Received Date', key: 'received_date', render: (val) => formatDate(val) },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status="APPROVED" text={val} /> },
    { label: 'Actions', key: 'id', className: 'text-right', render: (_, row) => (
      <button onClick={() => { navigate(`${deptPrefix}/sub-contract-challans/inward/details?id=${row.id}`); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="View Inward Receipt">
        <Eye className="w-4 h-4" />
      </button>
    )}
  ];

  const filteredData = activeTab === 'outward' 
    ? outwardChallans.filter(c => c.challan_number.toLowerCase().includes(searchTerm.toLowerCase()) || c.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : inwardChallans.filter(c => c.inward_number.toLowerCase().includes(searchTerm.toLowerCase()) || c.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl  text-slate-900">Subcontracting Challans</h1>
          <p className="text-slate-500 text-xs">Track outward material movement and vendor receipts</p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs
            tabs={[
              { label: 'Outward Challans', value: 'outward', icon: Send },
              { label: 'Inward Receipts', value: 'inward', icon: History }
            ]}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            className="border-none px-0"
          />
          
          
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <DataTable 
          columns={activeTab === 'outward' ? outwardColumns : inwardColumns}
          data={filteredData}
          loading={loading}
          emptyMessage={`No ${activeTab} challans found`}
        />
      </Card>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => navigate(`${deptPrefix}/sub-contract-challans/${activeTab}`)}
        title="Outward Challan"
        maxWidth="max-w-3xl"
      >
        {selectedChallan && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Dispatch Job Card {selectedChallan.job_card_no} to Vendor
                </h3>
                <p className="text-xs text-slate-500">
                  Create an outward challan for subcontracted operations
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <FormControl label="Operation">
                <input
                  type="text"
                  disabled
                  value={outwardFormData.operationName || ''}
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-700 outline-none cursor-not-allowed"
                />
              </FormControl>
              <FormControl label="Quantity">
                <input
                  type="text"
                  disabled
                  value={`${parseFloat(outwardFormData.plannedQty || 0).toFixed(3)} units`}
                  className="w-full p-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-700 outline-none cursor-not-allowed"
                />
              </FormControl>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded p-2 space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <User className="w-4 h-4" />
                <span className="text-xs">Assign Vendor</span>
              </div>
              <div className="relative">
                <select
                  disabled
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none bg-white text-slate-700 appearance-none pr-8 cursor-not-allowed font-medium"
                >
                  <option>{selectedChallan.vendor_name || '—'}</option>
                </select>
                <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <ClipboardList className="w-4 h-4" />
                  <span className="text-xs">Required Material Release</span>
                </div>
                <button
                  disabled
                  className="flex items-center gap-1 text-xs text-slate-400 px-2 py-1 bg-slate-100 rounded cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>

              <div className="border border-slate-100 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-2 text-slate-500 font-semibold">Item Code</th>
                      <th className="p-2 text-slate-500 font-semibold text-center">Required Qty</th>
                      <th className="p-2 text-slate-500 font-semibold text-center">Release Qty</th>
                      <th className="p-2 text-slate-500 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {outwardFormData.materialItems && outwardFormData.materialItems.length > 0 ? (
                      outwardFormData.materialItems.map((item, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="px-2 py-1.5 min-w-[200px]">
                            <div className="relative">
                              <select
                                disabled
                                className="w-full p-2 border border-slate-200 rounded text-xs bg-white text-slate-700 appearance-none pr-8 cursor-not-allowed font-medium"
                              >
                                <option>
                                  {(() => {
                                    const match = items.find(i => i.item_code === item.itemCode);
                                    const name = match ? (match.material_name || match.item_description || '') : '';
                                    return name ? `${item.itemCode} | ${name}` : item.itemCode;
                                  })()}
                                </option>
                              </select>
                              <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="text"
                              disabled
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-center outline-none bg-white text-slate-700 cursor-not-allowed font-medium"
                              value={parseFloat(item.requiredQty || 0).toFixed(3)}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="text"
                              disabled
                              className="w-20 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-center text-indigo-600 outline-none cursor-not-allowed font-semibold"
                              value={parseFloat(item.releaseQty || 0).toFixed(3)}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              disabled
                              className="p-1 text-slate-300 cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-center text-slate-400 italic">
                          No materials released
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <FormControl label="Dispatch Date">
                <input
                  type="date"
                  disabled
                  value={outwardFormData.dispatchDate}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </FormControl>
              <FormControl label="Expected Return Date">
                <input
                  type="date"
                  disabled
                  value={outwardFormData.expectedReturnDate}
                  className="w-full p-2 border border-slate-200 rounded text-xs outline-none bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </FormControl>
              <FormControl label="Dispatch Quantity">
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={parseFloat(outwardFormData.dispatchQty || 0).toFixed(3)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none text-slate-700 cursor-not-allowed pr-12 font-medium"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">Units</span>
                </div>
              </FormControl>
            </div>

            <FormControl label="Dispatch Notes">
              <textarea
                rows="2"
                disabled
                placeholder="Any specific instructions for the vendor..."
                value={outwardFormData.dispatchNotes}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none bg-slate-50 text-slate-500 cursor-not-allowed resize-none"
              />
            </FormControl>

            <div className="flex justify-end items-center gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => navigate(`${deptPrefix}/sub-contract-challans/${activeTab}`)}
                className="p-2 text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDownloadPDF(selectedChallan.id, selectedChallan.challan_number)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-all font-semibold shadow-lg shadow-emerald-100"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                disabled
                className="flex items-center gap-2 px-6 py-2 bg-indigo-300 text-white rounded cursor-not-allowed text-xs font-semibold"
              >
                <CheckCircle className="w-4 h-4" />
                Update Outward Challan
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isInwardModalOpen}
        onClose={() => { setIsInwardModalOpen(false); navigate(`${deptPrefix}/sub-contract-challans/${activeTab}`); }}
        title="Vendor Receipt (Inward)"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Receive Job Card {selectedChallan?.job_card_no} from Vendor</h3>
              <p className="text-xs text-slate-500">Challan No: {selectedChallan?.challan_number || selectedChallan?.outward_challan_no}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Received Date">
              <input
                type="date"
                disabled={isViewMode}
                value={inwardFormData.receivedDate}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </FormControl>
            <FormControl label="Received Quantity">
              <input
                type="number"
                disabled={isViewMode}
                value={inwardFormData.receivedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedQty: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormControl label="Accepted Qty">
              <input
                type="number"
                disabled={isViewMode}
                value={inwardFormData.acceptedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, acceptedQty: e.target.value })}
                className="w-full p-2 bg-emerald-50 border border-emerald-100 rounded text-sm text-emerald-700 outline-none disabled:opacity-75"
              />
            </FormControl>
            <FormControl label="Rejected Qty">
              <input
                type="number"
                disabled={isViewMode}
                value={inwardFormData.rejectedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, rejectedQty: e.target.value })}
                className="w-full p-2 bg-rose-50 border border-rose-100 rounded text-sm text-rose-700 outline-none disabled:opacity-75"
              />
            </FormControl>
            <FormControl label="Scrap Qty">
              <input
                type="number"
                disabled={isViewMode}
                value={inwardFormData.scrapQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, scrapQty: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 outline-none disabled:opacity-75"
              />
            </FormControl>
          </div>

          {inwardFormData.inwardItems && inwardFormData.inwardItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Package className="w-4 h-4" />
                <span className="text-xs font-semibold">Outward Items Breakdown</span>
              </div>
              <div className="border border-slate-100 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-2 text-slate-500">Item Code</th>
                      <th className="p-2 text-slate-500 text-center">Released Qty</th>
                      <th className="p-2 text-slate-500 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inwardFormData.inwardItems.map((item, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="p-2 text-slate-700">
                          {item.item_code}
                          {(() => {
                            const match = items.find(i => i.item_code === item.item_code);
                            const name = match ? (match.material_name || match.item_description || '') : '';
                            return name ? ` | ${name}` : '';
                          })()}
                        </td>
                        <td className="p-2 text-center text-slate-600">
                          <input
                            type="number"
                            disabled={isViewMode}
                            className="w-24 px-2 py-1 border border-slate-200 rounded text-center outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                            value={item.release_qty}
                            onChange={(e) => {
                              const newItems = [...inwardFormData.inwardItems];
                              newItems[idx].release_qty = e.target.value;
                              setInwardFormData({ ...inwardFormData, inwardItems: newItems });
                            }}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              disabled={isViewMode}
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                              value={item.rate}
                              onChange={(e) => {
                                const newItems = [...inwardFormData.inwardItems];
                                newItems[idx].rate = e.target.value;
                                setInwardFormData({ ...inwardFormData, inwardItems: newItems });
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/50 border-t border-slate-100 font-semibold">
                    <tr>
                      <td colSpan="2" className="p-2 text-right text-slate-500 text-xs">Sub Total</td>
                      <td className="p-2 text-right text-slate-700">
                        ₹ {inwardFormData.inwardItems.reduce((sum, item) => sum + (Number(item.release_qty || 0) * Number(item.rate || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="p-2 text-right text-slate-500 text-xs">GST (18%)</td>
                      <td className="p-2 text-right text-indigo-600">
                        ₹ {(inwardFormData.inwardItems.reduce((sum, item) => sum + (Number(item.release_qty || 0) * Number(item.rate || 0)), 0) * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-100/50">
                      <td colSpan="2" className="p-2 text-right text-slate-900 text-xs">Grand Total</td>
                      <td className="p-2 text-right text-emerald-600 text-sm">
                        ₹ {(inwardFormData.inwardItems.reduce((sum, item) => sum + (Number(item.release_qty || 0) * Number(item.rate || 0)), 0) * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormControl label="Vendor Invoice">
              <div className="relative group">
                <input
                  type="file"
                  id="vendorInvoice"
                  disabled={isViewMode}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                  onChange={(e) => setInwardFormData({ ...inwardFormData, vendorInvoice: e.target.files[0] })}
                />
                <label
                  htmlFor="vendorInvoice"
                  className={`flex items-center gap-2 p-2 border border-dashed border-slate-300 rounded transition-all ${isViewMode ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'cursor-pointer group-hover:border-emerald-500 group-hover:bg-emerald-50/30'}`}
                >
                  <div className={`p-1.5 bg-slate-100 text-slate-500 rounded ${isViewMode ? '' : 'group-hover:bg-emerald-100 group-hover:text-emerald-600'} transition-colors`}>
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-slate-600 truncate font-medium">
                      {inwardFormData.vendorInvoice ? inwardFormData.vendorInvoice.name : 'Upload Invoice Copy'}
                    </p>
                    <p className="text-xs text-slate-400">PDF, Excel or Images (Max 10MB)</p>
                  </div>
                  {inwardFormData.vendorInvoice && (
                    <div className="text-emerald-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  )}
                </label>
              </div>
            </FormControl>
            <FormControl label="Remarks / Rejection Reason">
              <textarea
                rows="1"
                placeholder="Notes..."
                disabled={isViewMode}
                value={inwardFormData.remarks}
                onChange={(e) => setInwardFormData({ ...inwardFormData, remarks: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded text-xs outline-none focus:border-emerald-500 resize-none h-[42px] disabled:bg-slate-50 disabled:text-slate-500"
              />
            </FormControl>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsInwardModalOpen(false)}
              className="p-2 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVendorInward}
              disabled={isViewMode}
              className={`flex items-center gap-2 px-6 py-2 rounded text-sm transition-all shadow-lg ${isViewMode
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 text-white'
                }`}
            >
              <CheckCircle className="w-4 h-4" />
              {isViewMode ? 'Receipt Completed' : 'Complete Receipt'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Challans;
