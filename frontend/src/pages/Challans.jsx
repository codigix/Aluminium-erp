import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, DataTable, StatusBadge, Modal, FormControl } from '../components/ui.jsx';
import { Truck, Package, Eye, Search, Filter, Calendar, User, Building2, ClipboardList, ArrowRight, Download, FileText, CheckCircle } from 'lucide-react';
import { successToast, errorToast } from '../utils/toast';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const Challans = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('outward');
  const [outwardChallans, setOutwardChallans] = useState([]);
  const [inwardChallans, setInwardChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);

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
      const challans = activeTab === 'outward' ? outwardChallans : inwardChallans;
      const challan = challans.find(c => String(c.id) === String(id));
      if (challan) {
        setSelectedChallan(challan);
        setIsViewModalOpen(true);
      }
    } else if (action === 'record-inward' && id) {
      const challan = outwardChallans.find(c => String(c.id) === String(id));
      if (challan && challan.status === 'DISPATCHED') {
        setSelectedChallan(challan);
        setInwardFormData(prev => ({
          ...prev,
          receivedQty: challan.dispatch_qty,
          acceptedQty: challan.dispatch_qty,
          inwardItems: []
        }));
        fetchInwardItems(challan.job_card_id);
        setIsInwardModalOpen(true);
      }
    } else {
      setIsViewModalOpen(false);
      setIsInwardModalOpen(false);
    }
  }, [location.pathname, searchParams, outwardChallans, inwardChallans, activeTab]);

  const handleTabChange = (tab) => {
    navigate(`/sub-contract-challans/${tab}`);
  };
  const [inwardFormData, setInwardFormData] = useState({
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    scrapQty: 0,
    remarks: '',
    receivedDate: new Date().toISOString().split('T')[0],
    inwardItems: []
  });

  const fetchInwardItems = async (jobCardId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/outward-challans/job-card/${jobCardId}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setInwardFormData(prev => ({ ...prev, inwardItems: data }));
    } catch (error) {
      console.error('Error fetching inward items:', error);
    }
  };

  const handleVendorInward = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const payload = {
        outwardChallanId: selectedChallan.id,
        jobCardId: selectedChallan.job_card_id,
        vendorId: selectedChallan.vendor_id,
        receivedDate: inwardFormData.receivedDate,
        vendorInvoiceNo: inwardFormData.remarks,
        totalReceivedQty: inwardFormData.receivedQty,
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
  }, [activeTab]);

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
    { label: 'Challan No', key: 'challan_number', className: 'font-medium text-indigo-600' },
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
        <button onClick={() => { navigate(`/sub-contract-challans/${activeTab}/details?id=${row.id}`); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="View Details">
          <Eye className="w-4 h-4" />
        </button>
        {row.status === 'DISPATCHED' && (
          <button 
            onClick={() => {
              navigate(`/sub-contract-challans/outward/record-inward?id=${row.id}`);
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
    { label: 'Inward No', key: 'inward_number', className: 'font-medium text-emerald-600' },
    { label: 'Outward Ref', key: 'outward_challan_no' },
    { label: 'Job Card', key: 'job_card_no' },
    { label: 'Vendor', key: 'vendor_name' },
    { label: 'Received Qty', key: 'total_received_qty', render: (val) => `${parseFloat(val || 0).toFixed(2)} units` },
    { label: 'Received Date', key: 'received_date', render: (val) => formatDate(val) },
    { label: 'Status', key: 'status', render: (val) => <StatusBadge status="APPROVED" text={val} /> },
    { label: 'Actions', key: 'id', className: 'text-right', render: (_, row) => (
      <button onClick={() => { navigate(`/sub-contract-challans/inward/details?id=${row.id}`); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded">
        <Eye className="w-4 h-4" />
      </button>
    )}
  ];

  const filteredData = activeTab === 'outward' 
    ? outwardChallans.filter(c => c.challan_number.toLowerCase().includes(searchTerm.toLowerCase()) || c.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : inwardChallans.filter(c => c.inward_number.toLowerCase().includes(searchTerm.toLowerCase()) || c.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subcontracting Challans</h1>
          <p className="text-slate-500 text-sm">Track outward material movement and vendor receipts</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => handleTabChange('outward')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'outward' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Outward Challans
            </button>
            <button 
              onClick={() => handleTabChange('inward')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'inward' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Inward Receipts
            </button>
          </div>
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
        onClose={() => navigate(`/sub-contract-challans/${activeTab}`)}
        title={activeTab === 'outward' ? 'Outward Challan Details' : 'Inward Receipt Details'}
        maxWidth="max-w-2xl"
      >
        {selectedChallan && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {activeTab === 'outward' ? 'Challan Number' : 'Inward Number'}
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {activeTab === 'outward' ? selectedChallan.challan_number : selectedChallan.inward_number}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</p>
                <StatusBadge 
                  status={selectedChallan.status === 'RECEIVED' ? 'APPROVED' : (selectedChallan.status === 'DISPATCHED' ? 'IN_PROGRESS' : 'PENDING')} 
                  text={selectedChallan.status} 
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Job Card</p>
                <p className="text-slate-900 font-semibold">{selectedChallan.job_card_no}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vendor</p>
                <p className="text-slate-900 font-semibold">{selectedChallan.vendor_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {activeTab === 'outward' ? 'Dispatch Qty' : 'Received Qty'}
                </p>
                <p className="text-slate-900 font-bold">
                  {activeTab === 'outward' ? selectedChallan.dispatch_qty : selectedChallan.total_received_qty} units
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {activeTab === 'outward' ? 'Dispatch Date' : 'Received Date'}
                </p>
                <p className="text-slate-900 font-semibold">
                  {formatDate(activeTab === 'outward' ? selectedChallan.dispatch_date : selectedChallan.received_date)}
                </p>
              </div>
            </div>

            {selectedChallan.notes && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Notes / Remarks</p>
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 italic text-sm text-slate-600">
                  {selectedChallan.notes}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => navigate(`/sub-contract-challans/${activeTab}`)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isInwardModalOpen}
        onClose={() => navigate('/sub-contract-challans/outward')}
        title="Vendor Receipt (Inward)"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Receive Job Card {selectedChallan?.job_card_no} from Vendor</h3>
              <p className="text-xs text-slate-500">Challan No: {selectedChallan?.challan_number}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Received Date">
              <input
                type="date"
                value={inwardFormData.receivedDate}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </FormControl>
            <FormControl label="Received Quantity">
              <input
                type="number"
                value={inwardFormData.receivedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, receivedQty: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormControl label="Accepted Qty">
              <input
                type="number"
                value={inwardFormData.acceptedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, acceptedQty: e.target.value })}
                className="w-full p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700 outline-none"
              />
            </FormControl>
            <FormControl label="Rejected Qty">
              <input
                type="number"
                value={inwardFormData.rejectedQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, rejectedQty: e.target.value })}
                className="w-full p-2 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-700 outline-none"
              />
            </FormControl>
            <FormControl label="Scrap Qty">
              <input
                type="number"
                value={inwardFormData.scrapQty}
                onChange={(e) => setInwardFormData({ ...inwardFormData, scrapQty: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none"
              />
            </FormControl>
          </div>

          <FormControl label="Remarks / Notes">
            <textarea
              rows="2"
              placeholder="Enter any notes or rejection reasons..."
              value={inwardFormData.remarks}
              onChange={(e) => setInwardFormData({ ...inwardFormData, remarks: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsInwardModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVendorInward}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              <CheckCircle className="w-4 h-4" />
              Complete Receipt
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Challans;
