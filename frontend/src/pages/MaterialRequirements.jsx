import React, { useState, useEffect } from 'react';
import { Card, StatusBadge, FormControl, Modal, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

const MaterialRequirements = () => {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedMat, setSelectedMat] = useState(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [issueData, setIssueData] = useState({
    workOrderId: '',
    quantity: 0,
    remarks: ''
  });

  useEffect(() => {
    fetchRequirements();
    fetchWorkOrders();
  }, []);

  const fetchRequirements = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-requirements/global`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRequirements(data);
      } else {
        throw new Error('Failed to fetch material requirements');
      }
    } catch (error) {
      console.error('Error:', error);
      errorToast(error.message);
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

  const handleShowDetails = (mat) => {
    setSelectedMat(mat);
    setIsDetailsModalOpen(true);
  };

  const handleOpenIssue = (mat) => {
    setSelectedMat(mat);
    setIssueData({
      workOrderId: '',
      quantity: Math.min(mat.available_qty, mat.required_qty),
      remarks: `Material issue for ${mat.material_name}`
    });
    setIsIssueModalOpen(true);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueData.workOrderId) return errorToast('Please select a work order');
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/material-issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workOrderId: issueData.workOrderId,
          remarks: issueData.remarks,
          items: [{
            materialName: selectedMat.material_name,
            materialType: selectedMat.material_type,
            quantity: issueData.quantity,
            uom: selectedMat.uom
          }]
        })
      });

      if (response.ok) {
        successToast('Material issued successfully');
        setIsIssueModalOpen(false);
        fetchRequirements();
      } else {
        const err = await response.json();
        errorToast(err.error || 'Failed to issue material');
      }
    } catch (error) {
      errorToast('Network error');
    }
  };

  const materialTypes = ['ALL', ...new Set(requirements.map(r => r.material_type))];

  const columns = [
    {
      label: 'Material Name',
      key: 'material_name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className=" text-slate-900">{val}</div>
          <div className="text-[10px] text-slate-400">{row.details.length} linked project(s)</div>
        </div>
      )
    },
    {
      label: 'Type',
      key: 'material_type',
      sortable: true,
      render: (val) => (
        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
          {val}
        </span>
      )
    },
    {
      label: 'Required Qty',
      key: 'required_qty',
      sortable: true,
      className: 'text-center',
      render: (val, row) => `${val.toFixed(2)} ${row.uom}`
    },
    {
      label: 'Stock Available',
      key: 'available_qty',
      sortable: true,
      className: 'text-center',
      render: (val, row) => (
        <span className=" text-slate-700">
          {val.toFixed(2)} {row.uom}
        </span>
      )
    },
    {
      label: 'Shortage',
      key: 'shortage',
      sortable: true,
      className: 'text-center',
      render: (val, row) => val > 0 ? (
        <span className="text-rose-600 ">{val.toFixed(2)} {row.uom}</span>
      ) : (
        <span className="text-emerald-600">—</span>
      )
    },
    {
      label: 'Status',
      key: 'shortage',
      render: (val) => val > 0 ? (
        <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] ">SHORTAGE</span>
      ) : (
        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] ">AVAILABLE</span>
      )
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => handleShowDetails(row)}
            className="text-indigo-600 hover:text-indigo-900 font-medium text-xs"
          >
            Details
          </button>
          {row.available_qty > 0 && (
            <button 
              onClick={() => handleOpenIssue(row)}
              className="bg-emerald-600 text-white hover:bg-emerald-700  text-[10px] px-2 py-1 rounded shadow-sm"
            >
              Issue
            </button>
          )}
        </div>
      )
    }
  ];

  const totalRequired = requirements.length;
  const withShortage = requirements.filter(r => r.shortage > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-slate-900">Material Requirements</h2>
          <p className="text-sm text-slate-500">Plan and allocate materials for active production orders</p>
        </div>
        <button 
          onClick={fetchRequirements}
          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white">
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Total Items Needed</p>
            <p className="text-xl text-slate-900 mt-1">{totalRequired}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Items with Shortage</p>
            <p className="text-2xl  text-rose-600 mt-1">{withShortage}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Stock Health</p>
            <p className="text-2xl  text-emerald-600 mt-1">
              {totalRequired ? Math.round(((totalRequired - withShortage) / totalRequired) * 100) : 100}%
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-xs text-slate-500 font-medium  tracking-wider">Active Plans</p>
            <p className="text-2xl  text-indigo-600 mt-1">
              {[...new Set(requirements.flatMap(r => r.details.map(d => d.plan_code)))].length}
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <DataTable 
          columns={columns}
          data={requirements.filter(req => typeFilter === 'ALL' || req.material_type === typeFilter)}
          loading={loading}
          searchPlaceholder="Search materials, projects..."
          actions={
            <div className="w-48">
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {materialTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          }
        />
      </Card>

      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Material Details: ${selectedMat?.material_name}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500 text-xs">Total Required</p>
              <p className=" text-lg">{selectedMat?.required_qty} {selectedMat?.uom}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500 text-xs">Stock Available</p>
              <p className=" text-lg text-emerald-600">{selectedMat?.available_qty} {selectedMat?.uom}</p>
            </div>
          </div>
          
          <h4 className=" text-slate-800 text-sm border-b pb-2">Linked Projects & Plans</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {selectedMat?.details.map((d, i) => (
              <div key={i} className="flex justify-between items-center p-2 border rounded-lg text-sm">
                <div>
                  <div className="">{d.project_name}</div>
                  <div className="text-xs text-slate-500">Plan: {d.plan_code} | Item: {d.item_code}</div>
                </div>
                <div className=" text-indigo-600">{d.qty} {selectedMat.uom}</div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title={`Issue Material: ${selectedMat?.material_name}`}
      >
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          <FormControl label="Work Order">
            <select 
              value={issueData.workOrderId}
              onChange={(e) => setIssueData(prev => ({ ...prev, workOrderId: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              required
            >
              <option value="">Select Work Order</option>
              {workOrders.map(wo => (
                <option key={wo.id} value={wo.id}>{wo.wo_number} - {wo.project_name}</option>
              ))}
            </select>
          </FormControl>

          <div className="grid grid-cols-2 gap-4">
            <FormControl label="Issue Quantity">
              <div className="relative">
                <input 
                  type="number" 
                  step="0.001"
                  max={selectedMat?.available_qty}
                  value={issueData.quantity}
                  onChange={(e) => setIssueData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  required
                />
                <span className="absolute right-3 top-2 text-slate-400 text-xs">{selectedMat?.uom}</span>
              </div>
            </FormControl>
            <div className="flex flex-col justify-end pb-1 text-xs text-slate-500">
              <p>Available: {selectedMat?.available_qty}</p>
              <p>Required: {selectedMat?.required_qty}</p>
            </div>
          </div>

          <FormControl label="Remarks">
            <input 
              type="text" 
              value={issueData.remarks}
              onChange={(e) => setIssueData(prev => ({ ...prev, remarks: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="E.g., Floor issue for production"
            />
          </FormControl>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button"
              onClick={() => setIsIssueModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
            >
              Confirm Issue
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MaterialRequirements;

