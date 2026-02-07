import React, { useState, useEffect } from 'react';
import { FormControl, StatusBadge } from '../components/ui';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const WarehouseAllocation = () => {
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocatingId, setAllocatingId] = useState(null);
  const [allocationData, setAllocationData] = useState({});

  useEffect(() => {
    fetchPendingAllocations();
  }, []);

  const fetchPendingAllocations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouse-allocations/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch pending allocations');
      const data = await response.json();
      setPendingItems(data);
      
      // Initialize allocation data for each item
      const initialData = {};
      data.forEach(item => {
        initialData[item.grn_item_id] = {
          target_warehouse: '',
          allocate_qty: item.pending_allocation_qty,
          remarks: ''
        };
      });
      setAllocationData(initialData);
    } catch (error) {
      console.error(error);
      errorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (itemId, field, value) => {
    setAllocationData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleAllocate = async (item) => {
    const data = allocationData[item.grn_item_id];
    
    if (!data.target_warehouse) {
      errorToast('Please select a target warehouse');
      return;
    }

    if (parseFloat(data.allocate_qty) <= 0 || parseFloat(data.allocate_qty) > item.pending_allocation_qty) {
      errorToast('Invalid allocation quantity');
      return;
    }

    setAllocatingId(item.grn_item_id);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/warehouse-allocations/allocate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          grn_item_id: item.grn_item_id,
          target_warehouse: data.target_warehouse,
          allocate_qty: data.allocate_qty,
          remarks: data.remarks
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Allocation failed');
      }

      successToast('Material allocated successfully');
      fetchPendingAllocations();
    } catch (error) {
      errorToast(error.message);
    } finally {
      setAllocatingId(null);
    }
  };

  const warehouseOptions = [
    { value: 'RM', label: 'Raw Material Warehouse' },
    { value: 'WIP', label: 'Production Issue (WIP)' },
    { value: 'FG', label: 'Finished Goods' },
    { value: 'SUB', label: 'Subcontract Store' },
    { value: 'REJECT', label: 'Rejected Store' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center ">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading pending allocations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-1">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl text-slate-900">Warehouse Allocation</h1>
            <p className="text-sm text-slate-500 font-medium">Assign accepted material from GRN to warehouse locations</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500  tracking-[0.2em] text-[10px]  ">
              <tr>
                <th className="p-2 text-left">Source (GRN/PO)</th>
                <th className="p-2 text-left">Item Details</th>
                <th className="p-2 text-right">Accepted</th>
                <th className="p-2 text-right">Allocated</th>
                <th className="p-2 text-right">Pending</th>
                <th className="p-2 text-left">Target Warehouse</th>
                <th className="p-2 text-left">Allocate Qty</th>
                <th className="p-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center">
                    <div className="p-3 bg-slate-50 rounded-full shadow-sm w-fit mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-slate-500 font-medium">No items pending allocation</p>
                    <p className="text-xs text-slate-400 mt-1">All received materials have been distributed</p>
                  </td>
                </tr>
              ) : (
                pendingItems.map((item) => (
                  <tr key={item.grn_item_id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className=" text-indigo-600">#{item.grn_number}</div>
                      <div className="text-[10px] text-slate-400   tracking-tight mt-0.5">PO: {item.po_number}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className=" text-slate-900">{item.item_code}</div>
                      <div className="text-xs text-slate-500 max-w-[200px] truncate">{item.material_name}</div>
                    </td>
                    <td className="px-6 py-5 text-right font-mono  text-emerald-600 bg-emerald-50/30">
                      {parseFloat(item.accepted_qty).toFixed(3)}
                    </td>
                    <td className="px-6 py-5 text-right font-mono  text-slate-400">
                      {parseFloat(item.allocated_qty || 0).toFixed(3)}
                    </td>
                    <td className="px-6 py-5 text-right font-mono  text-rose-600 bg-rose-50/30">
                      {parseFloat(item.pending_allocation_qty).toFixed(3)}
                    </td>
                    <td className="px-6 py-5">
                      <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
                        value={allocationData[item.grn_item_id]?.target_warehouse || ''}
                        onChange={(e) => handleInputChange(item.grn_item_id, 'target_warehouse', e.target.value)}
                      >
                        <option value="">Select WH</option>
                        {warehouseOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <input
                        type="number"
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-xs  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={allocationData[item.grn_item_id]?.allocate_qty || ''}
                        onChange={(e) => handleInputChange(item.grn_item_id, 'allocate_qty', e.target.value)}
                        max={item.pending_allocation_qty}
                        min="0"
                        step="0.001"
                      />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => handleAllocate(item)}
                        disabled={allocatingId === item.grn_item_id}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white  text-xs transition-all shadow-sm ${
                          allocatingId === item.grn_item_id 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-100'
                        }`}
                      >
                        {allocatingId === item.grn_item_id ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Wait...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            Allocate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WarehouseAllocation;

