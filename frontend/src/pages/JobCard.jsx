import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const JobCard = () => {
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [operations, setOperations] = useState([]);
  const [workstations, setWorkstations] = useState([]);

  const [formData, setFormData] = useState({
    jcNumber: '',
    workOrderId: '',
    operationId: '',
    workstationId: '',
    assignedTo: '',
    plannedQty: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchJobCards();
    fetchWorkOrders();
    fetchOperations();
    fetchWorkstations();
  }, []);

  const fetchJobCards = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobCards(data);
      }
    } catch (error) {
      console.error('Error fetching job cards:', error);
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const fetchOperations = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/operations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      }
    } catch (error) {
      console.error('Error fetching operations:', error);
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

  const handleWOSelect = (woId) => {
    const wo = workOrders.find(w => w.id.toString() === woId);
    setSelectedWO(wo);
    setFormData(prev => ({ 
      ...prev, 
      workOrderId: woId, 
      plannedQty: wo?.quantity || 0 
    }));
  };

  const handleOperationSelect = (opId) => {
    const op = operations.find(o => o.id.toString() === opId);
    setFormData(prev => ({ 
      ...prev, 
      operationId: opId, 
      workstationId: op?.workstation_id || prev.workstationId 
    }));
  };

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedJC, setSelectedJC] = useState(null);
  const [progressData, setProgressData] = useState({
    producedQty: 0,
    rejectedQty: 0,
    remarks: ''
  });

  const handleLogProgress = (jc) => {
    setSelectedJC(jc);
    setProgressData({
      producedQty: 0,
      rejectedQty: 0,
      remarks: jc.remarks || ''
    });
    setIsProgressModalOpen(true);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('authToken');
      const payload = { status };
      if (status === 'IN_PROGRESS') payload.startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (status === 'COMPLETED') payload.endTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const response = await fetch(`${API_BASE}/job-cards/${id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        Swal.fire('Updated', `Job Card status: ${status}`, 'success');
        fetchJobCards();
      }
    } catch (error) {
      Swal.fire('Error', 'Failed to update status', 'error');
    }
  };

  const submitProgress = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards/${selectedJC.id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          producedQty: parseFloat(selectedJC.produced_qty || 0) + parseFloat(progressData.producedQty),
          rejectedQty: parseFloat(selectedJC.rejected_qty || 0) + parseFloat(progressData.rejectedQty),
          remarks: progressData.remarks
        })
      });

      if (response.ok) {
        Swal.fire('Success', 'Progress logged successfully', 'success');
        setIsProgressModalOpen(false);
        fetchJobCards();
      }
    } catch (error) {
      Swal.fire('Error', 'Failed to log progress', 'error');
    }
  };

  const handleCreateNew = () => {
    setFormData({
      jcNumber: `JC-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(jobCards.length + 1).toString().padStart(3, '0')}`,
      workOrderId: '',
      operationId: '',
      workstationId: '',
      assignedTo: '',
      plannedQty: 0,
      remarks: ''
    });
    setSelectedWO(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/job-cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        Swal.fire('Success', 'Job Card created successfully', 'success');
        setIsModalOpen(false);
        fetchJobCards();
      } else {
        const error = await response.json();
        Swal.fire('Error', error.error || 'Failed to create Job Card', 'error');
      }
    } catch (error) {
      Swal.fire('Error', 'Network error', 'error');
    }
  };

  const columns = [
    {
      label: 'JC Number',
      key: 'jc_number',
      sortable: true,
      render: (val, row) => <span className="font-bold text-slate-900">{val || `JC-${row.id.toString().padStart(4, '0')}`}</span>
    },
    {
      label: 'WO Reference',
      key: 'wo_number',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800">{val}</span>
          {row.item_status === 'Rejected' && (
            <span className="w-fit px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-100 text-rose-600 animate-pulse uppercase border border-rose-200 mt-1">
              Rejected Drawing
            </span>
          )}
        </div>
      )
    },
    {
      label: 'Operation / Workstation',
      key: 'operation_name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-bold text-indigo-600">{val || 'Manual Operation'}</div>
          <div className="text-[10px] text-slate-500">{row.workstation_name || 'General Station'}</div>
        </div>
      )
    },
    {
      label: 'Operator',
      key: 'operator_name',
      sortable: true,
      render: (val, row) => <span className="text-slate-600 font-medium">{val || row.assigned_to || 'Unassigned'}</span>
    },
    {
      label: 'Qty (P/A)',
      key: 'planned_qty',
      className: 'text-center',
      render: (val, row) => (
        <div className="flex flex-col items-center">
          <div className="font-semibold text-slate-700">{val} / {row.produced_qty}</div>
          <div className="w-24 bg-slate-100 rounded-full h-1 mt-1">
            <div 
              className="bg-indigo-500 h-1 rounded-full transition-all" 
              style={{ width: `${Math.min(100, (row.produced_qty / val) * 100)}%` }}
            ></div>
          </div>
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
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {row.status === 'PENDING' && (
            <button 
              onClick={() => handleUpdateStatus(row.id, 'IN_PROGRESS')}
              disabled={row.item_status === 'Rejected'}
              className={`text-xs font-bold px-2 py-1 rounded ${
                row.item_status === 'Rejected' 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              Start
            </button>
          )}
          {row.status === 'IN_PROGRESS' && (
            <>
              <button 
                onClick={() => handleLogProgress(row)}
                className="text-indigo-600 hover:text-indigo-900 text-xs font-bold px-2 py-1 rounded hover:bg-indigo-50"
              >
                Log
              </button>
              <button 
                onClick={() => handleUpdateStatus(row.id, 'COMPLETED')}
                className="text-amber-600 hover:text-amber-900 text-xs font-bold px-2 py-1 rounded hover:bg-amber-50"
              >
                Done
              </button>
            </>
          )}
          <button className="p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
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
          <h2 className="text-xl text-slate-900">Job Cards</h2>
          <p className="text-sm text-slate-500">Track individual operations and shop floor activities</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Job Card
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Active Jobs</p>
            <p className="text-xl text-slate-900 mt-1">{jobCards.filter(jc => jc.status === 'IN_PROGRESS').length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {jobCards.filter(jc => jc.status === 'PENDING').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {jobCards.filter(jc => jc.status === 'COMPLETED').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Average Progress</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {jobCards.length ? Math.round(jobCards.reduce((acc, jc) => acc + (jc.produced_qty / jc.planned_qty), 0) / jobCards.length * 100) : 0}%
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <DataTable 
          columns={columns}
          data={jobCards}
          loading={loading}
          searchPlaceholder="Search job cards, operators, operations..."
        />
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create Job Card"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Job Card Number">
              <input 
                type="text" 
                value={formData.jcNumber} 
                disabled 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600"
              />
            </FormControl>
            <FormControl label="Work Order">
              <select 
                value={formData.workOrderId} 
                onChange={(e) => handleWOSelect(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                required
              >
                <option value="">Select Work Order</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.project_name}</option>
                ))}
              </select>
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Operation">
              <select 
                value={formData.operationId}
                onChange={(e) => handleOperationSelect(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                required
              >
                <option value="">Select Operation</option>
                {operations.map(op => (
                  <option key={op.id} value={op.id}>{op.operation_name} ({op.operation_code})</option>
                ))}
              </select>
            </FormControl>
            <FormControl label="Workstation">
              <select 
                value={formData.workstationId}
                onChange={(e) => setFormData(prev => ({ ...prev, workstationId: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">Select Workstation</option>
                {workstations.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.workstation_name}</option>
                ))}
              </select>
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl label="Operator Name">
              <input 
                type="text" 
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Person assigned..."
              />
            </FormControl>
            <FormControl label="Planned Quantity">
              <input 
                type="number" 
                value={formData.plannedQty}
                onChange={(e) => setFormData(prev => ({ ...prev, plannedQty: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                required
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <FormControl label="Remarks">
              <input 
                type="text" 
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Job instructions..."
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
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
            >
              Create Job Card
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title={`Log Progress - ${selectedJC?.jc_number || 'Job Card'}`}
      >
        <form onSubmit={submitProgress} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
            <div className="flex justify-between text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              <span>Operation: {selectedJC?.operation_name}</span>
              <span>Planned: {selectedJC?.planned_qty}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-700">
              <span>Produced: {selectedJC?.produced_qty}</span>
              <span>Rejected: {selectedJC?.rejected_qty}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Produced Quantity">
              <input
                type="number"
                step="0.001"
                value={progressData.producedQty}
                onChange={(e) => setProgressData(prev => ({ ...prev, producedQty: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                required
              />
            </FormControl>
            <FormControl label="Rejected Quantity">
              <input
                type="number"
                step="0.001"
                value={progressData.rejectedQty}
                onChange={(e) => setProgressData(prev => ({ ...prev, rejectedQty: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </FormControl>
          </div>

          <FormControl label="Remarks / Notes">
            <textarea
              value={progressData.remarks}
              onChange={(e) => setProgressData(prev => ({ ...prev, remarks: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-full h-24"
              placeholder="Any issues or notes from the floor..."
            ></textarea>
          </FormControl>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsProgressModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
            >
              Log Progress
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default JobCard;
