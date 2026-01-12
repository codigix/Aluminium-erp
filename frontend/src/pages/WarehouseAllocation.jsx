import React, { useState, useEffect } from 'react';
import { FormControl, StatusBadge } from '../components/ui';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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
      Swal.fire('Error', error.message, 'error');
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
      Swal.fire('Error', 'Please select a target warehouse', 'error');
      return;
    }

    if (parseFloat(data.allocate_qty) <= 0 || parseFloat(data.allocate_qty) > item.pending_allocation_qty) {
      Swal.fire('Error', 'Invalid allocation quantity', 'error');
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

      Swal.fire('Success', 'Material allocated successfully', 'success');
      fetchPendingAllocations();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Warehouse Allocation</h1>
        <p className="text-gray-600">Assign accepted material from GRN to warehouse locations</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GRN / PO</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QC Accepted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Warehouse</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocate Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {pendingItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No items pending allocation found
                  </td>
                </tr>
              ) : (
                pendingItems.map((item) => (
                  <tr key={item.grn_item_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-blue-600">{item.grn_number}</div>
                      <div className="text-xs text-gray-500">PO: {item.po_number}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{item.item_code}</div>
                      <div className="text-xs text-gray-500">{item.material_name}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-green-600">
                      {item.accepted_qty}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {item.allocated_qty}
                    </td>
                    <td className="px-4 py-4 font-bold text-orange-600">
                      {item.pending_allocation_qty}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={allocationData[item.grn_item_id]?.target_warehouse || ''}
                        onChange={(e) => handleInputChange(item.grn_item_id, 'target_warehouse', e.target.value)}
                      >
                        <option value="">Select WH</option>
                        {warehouseOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        className="block w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={allocationData[item.grn_item_id]?.allocate_qty || ''}
                        onChange={(e) => handleInputChange(item.grn_item_id, 'allocate_qty', e.target.value)}
                        max={item.pending_allocation_qty}
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleAllocate(item)}
                        disabled={allocatingId === item.grn_item_id}
                        className={`px-4 py-2 rounded text-white font-medium text-sm ${
                          allocatingId === item.grn_item_id 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                        }`}
                      >
                        {allocatingId === item.grn_item_id ? 'Wait...' : 'Allocate'}
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
