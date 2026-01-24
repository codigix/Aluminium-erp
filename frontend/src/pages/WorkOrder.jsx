import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const formatDisplayDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const WorkOrder = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [salesOrders, setSalesOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [workstations, setWorkstations] = useState([]);

  const [newWO, setNewWO] = useState({
    woNumber: '',
    salesOrderId: '',
    salesOrderItemId: '',
    quantity: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    workstationId: '',
    priority: 'NORMAL',
    remarks: ''
  });

  useEffect(() => {
    fetchWorkOrders();
    fetchSalesOrders();
    fetchWorkstations();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSalesOrders(data);
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
    }
  };

  const fetchWorkstations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/workstations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkstations(data);
      }
    } catch (error) {
      console.error('Error fetching workstations:', error);
    }
  };

  const handleOrderSelect = async (orderId) => {
    setSelectedOrderId(orderId);
    setNewWO(prev => ({ ...prev, salesOrderId: orderId, salesOrderItemId: '' }));
    
    if (!orderId) {
      setSelectedOrderDetails(null);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedOrderDetails(data);
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
    }
  };

  const handleCreateNew = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders/next-number`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      setNewWO({
        woNumber: data.woNumber,
        salesOrderId: '',
        salesOrderItemId: '',
        quantity: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        workstationId: '',
        priority: 'NORMAL',
        remarks: ''
      });
      setSelectedOrderId('');
      setSelectedOrderDetails(null);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error getting next WO number:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/work-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newWO)
      });

      if (response.ok) {
        successToast('Work Order created successfully');
        setIsModalOpen(false);
        fetchWorkOrders();
      } else {
        const error = await response.json();
        errorToast(error.error || 'Failed to create Work Order');
      }
    } catch (error) {
      errorToast('Network error');
    }
  };

  const columns = [
    {
      label: 'WO Number',
      key: 'wo_number',
      sortable: true,
      render: (val) => <span className=" text-slate-900">{val}</span>
    },
    {
      label: 'Project / SO',
      key: 'project_name',
      sortable: true,
      render: (val) => <span className="font-medium text-slate-800">{val}</span>
    },
    {
      label: 'Item Details',
      key: 'item_code',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-indigo-600">{val}</div>
          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{row.description}</div>
        </div>
      )
    },
    {
      label: 'Qty',
      key: 'quantity',
      sortable: true,
      render: (val) => <span className=" text-slate-700">{val} NOS</span>
    },
    {
      label: 'Schedule',
      key: 'start_date',
      render: (_, row) => (
        <div className="text-[11px] text-slate-600">
          <div>Start: {formatDisplayDate(row.start_date)}</div>
          <div>End: {formatDisplayDate(row.end_date)}</div>
        </div>
      )
    },
    {
      label: 'Progress',
      key: 'progress',
      sortable: true,
      render: (val) => (
        <div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 max-w-[100px]">
            <div 
              className={`h-1.5 rounded-full ${val > 80 ? 'bg-emerald-500' : val > 40 ? 'bg-blue-500' : 'bg-amber-500'}`} 
              style={{ width: `${val || 0}%` }}
            ></div>
          </div>
          <span className="text-[10px]  text-slate-500">{val || 0}%</span>
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: () => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-slate-900">Work Orders</h2>
          <p className="text-sm text-slate-500">Manage manufacturing orders and production progress</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Work Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white">
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Total Active</p>
            <p className="text-xl text-slate-900 mt-1">{workOrders.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">In Progress</p>
            <p className="text-2xl  text-blue-600 mt-1">
              {workOrders.filter(wo => wo.status === 'IN_PROGRESS').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Completed</p>
            <p className="text-2xl  text-emerald-600 mt-1">
              {workOrders.filter(wo => wo.status === 'COMPLETED').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Pending</p>
            <p className="text-2xl  text-amber-600 mt-1">
              {workOrders.filter(wo => wo.status === 'CREATED').length}
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <DataTable 
          columns={columns}
          data={workOrders}
          loading={loading}
          searchPlaceholder="Search work orders, items, projects..."
        />
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Work Order"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Work Order Number">
              <input 
                type="text" 
                value={newWO.woNumber} 
                disabled 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm  text-slate-600"
              />
            </FormControl>
            <FormControl label="Priority">
              <select 
                value={newWO.priority} 
                onChange={(e) => setNewWO(prev => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <FormControl label="Select Sales Order">
              <SearchableSelect 
                options={salesOrders.map(so => ({
                  label: `${so.project_name} (${so.po_number || 'No PO'})`,
                  value: so.id.toString(),
                  subLabel: so.company_name
                }))}
                value={selectedOrderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
                placeholder="Search sales order..."
                allowCustom={false}
              />
            </FormControl>
          </div>

          {selectedOrderDetails && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <FormControl label="Select Item from SO">
                <select 
                  value={newWO.salesOrderItemId}
                  onChange={(e) => {
                    const itemId = e.target.value;
                    const item = selectedOrderDetails.items.find(i => i.id.toString() === itemId);
                    setNewWO(prev => ({ 
                      ...prev, 
                      salesOrderItemId: itemId,
                      quantity: item ? item.quantity : 0
                    }));
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  required
                >
                  <option value="">Choose an item...</option>
                  {selectedOrderDetails.items.map(item => (
                    <option key={item.id} value={item.id} disabled={item.status === 'Rejected'}>
                      {item.item_code} - {item.description} (Qty: {item.quantity} {item.unit}) {item.status === 'Rejected' ? '[REJECTED]' : ''}
                    </option>
                  ))}
                </select>
              </FormControl>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormControl label="Quantity to Produce">
              <input 
                type="number" 
                value={newWO.quantity}
                onChange={(e) => setNewWO(prev => ({ ...prev, quantity: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                required
              />
            </FormControl>
            <FormControl label="Start Date">
              <input 
                type="date" 
                value={newWO.startDate}
                onChange={(e) => setNewWO(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                required
              />
            </FormControl>
            <FormControl label="End Date">
              <input 
                type="date" 
                value={newWO.endDate}
                onChange={(e) => setNewWO(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                required
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Primary Workstation">
              <select 
                value={newWO.workstationId}
                onChange={(e) => setNewWO(prev => ({ ...prev, workstationId: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">Select Workstation</option>
                {workstations.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.workstation_name} ({ws.workstation_code})</option>
                ))}
              </select>
            </FormControl>
            <FormControl label="Remarks">
              <input 
                type="text" 
                value={newWO.remarks}
                onChange={(e) => setNewWO(prev => ({ ...prev, remarks: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Manufacturing notes..."
              />
            </FormControl>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm shadow-indigo-200"
            >
              Release Work Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WorkOrder;
