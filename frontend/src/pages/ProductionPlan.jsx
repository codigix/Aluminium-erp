import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const ProductionPlan = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [readyItems, setReadyItems] = useState([]);
  const [workstations, setWorkstations] = useState([]);
  const [nextPlanCode, setNextPlanCode] = useState('');
  const [productionReadyOrders, setProductionReadyOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  
  const [newPlan, setNewPlan] = useState({
    planCode: '',
    planDate: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: '',
    remarks: '',
    items: []
  });

  useEffect(() => {
    fetchPlans();
    fetchWorkstations();
  }, []);

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
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

  const fetchReadyItems = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/ready-items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReadyItems(data);
      }
    } catch (error) {
      console.error('Error fetching ready items:', error);
    }
  };

  const fetchReadyOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/ready-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProductionReadyOrders(data);
      }
    } catch (error) {
      console.error('Error fetching ready orders:', error);
    }
  };

  const fetchNextCode = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/next-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNextPlanCode(data.planCode);
        setNewPlan(prev => ({ ...prev, planCode: data.planCode }));
      }
    } catch (error) {
      console.error('Error fetching next code:', error);
    }
  };

  const handleCreateNew = () => {
    fetchReadyItems();
    fetchReadyOrders();
    fetchNextCode();
    setSelectedOrderId('');
    setSelectedOrderDetails(null);
    setNewPlan({
      planCode: '',
      planDate: new Date().toISOString().split('T')[0],
      startDate: '',
      endDate: '',
      remarks: '',
      items: []
    });
    setIsModalOpen(true);
  };

  const handleOrderSelect = async (orderId) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setSelectedOrderDetails(null);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans/sales-order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedOrderDetails(data);
        
        // Filter readyItems to only show items from this SO
        const filteredReadyItems = readyItems.filter(item => item.sales_order_id === parseInt(orderId));
        // If some items are already selected but not in this SO, we might want to keep them or clear them.
        // Usually, selecting a SO means we focus on its items.
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
      Swal.fire('Error', 'Failed to fetch sales order details', 'error');
    }
  };

  const toggleItemSelection = (item) => {
    const exists = newPlan.items.find(i => i.salesOrderItemId === item.sales_order_item_id);
    if (exists) {
      setNewPlan(prev => ({
        ...prev,
        items: prev.items.filter(i => i.salesOrderItemId !== item.sales_order_item_id)
      }));
    } else {
      setNewPlan(prev => ({
        ...prev,
        items: [...prev.items, {
          salesOrderId: item.sales_order_id,
          salesOrderItemId: item.sales_order_item_id,
          projectName: item.project_name,
          itemCode: item.item_code,
          description: item.description,
          plannedQty: (item.total_qty || item.quantity) - (item.already_planned_qty || 0),
          totalQty: item.total_qty || item.quantity,
          alreadyPlannedQty: item.already_planned_qty || 0,
          workstationId: '',
          plannedStartDate: prev.startDate,
          plannedEndDate: prev.endDate,
          // Store additional details for display
          materials: item.materials || [],
          components: item.components || [],
          operations: item.operations || []
        }]
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...newPlan.items];
    updatedItems[index][field] = value;
    setNewPlan(prev => ({ ...prev, items: updatedItems }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPlan.items.length === 0) {
      Swal.fire('Error', 'Please select at least one item', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/production-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPlan)
      });

      if (response.ok) {
        Swal.fire('Success', 'Production plan created successfully', 'success');
        setIsModalOpen(false);
        fetchPlans();
      } else {
        const error = await response.json();
        Swal.fire('Error', error.message || 'Failed to create production plan', 'error');
      }
    } catch (error) {
      Swal.fire('Error', 'An unexpected error occurred', 'error');
    }
  };

  const columns = [
    {
      label: 'Plan Code',
      key: 'plan_code',
      sortable: true,
      render: (val) => <span className="font-medium text-slate-900">{val}</span>
    },
    {
      label: 'Plan Date',
      key: 'plan_date',
      sortable: true,
      render: (val) => new Date(val).toLocaleDateString()
    },
    {
      label: 'Period',
      key: 'id',
      render: (_, row) => (
        <span className="text-slate-600">
          {row.start_date ? new Date(row.start_date).toLocaleDateString() : 'N/A'} - 
          {row.end_date ? new Date(row.end_date).toLocaleDateString() : 'N/A'}
        </span>
      )
    },
    {
      label: 'Status',
      key: 'status',
      sortable: true,
      render: (val) => <StatusBadge status={val} />
    },
    {
      label: 'Created By',
      key: 'creator_name',
      sortable: true
    },
    {
      label: 'Actions',
      key: 'id',
      className: 'text-right',
      render: (val) => (
        <button 
          className="text-indigo-600 hover:text-indigo-900 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {/* View logic */}}
        >
          View
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-slate-900">Production Plan</h2>
          <p className="text-sm text-slate-500">Manage and schedule production activities</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
        >
          Create Production Plan
        </button>
      </div>

      <Card>
        <DataTable 
          columns={columns}
          data={plans}
          loading={loading}
          searchPlaceholder="Search plans..."
        />
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create Production Plan"
      >
        <form onSubmit={handleSubmit} className="">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-3">
            <FormControl label="Search Sales Order">
              <SearchableSelect 
                options={productionReadyOrders.map(so => ({
                  label: `${so.project_name} (${so.po_number || 'No PO'}) - ${so.company_name}`,
                  value: so.id.toString()
                }))}
                value={selectedOrderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
                placeholder="Search and select sales order..."
                allowCustom={false}
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <FormControl label="Plan Code">
              <input 
                type="text" 
                value={newPlan.planCode} 
                disabled 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm"
              />
            </FormControl>
            <FormControl label="Plan Date">
              <input 
                type="date" 
                value={newPlan.planDate} 
                onChange={(e) => setNewPlan(prev => ({ ...prev, planDate: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-md text-xs"
                required
              />
            </FormControl>
            <FormControl label="Remarks">
              <input 
                type="text" 
                value={newPlan.remarks} 
                onChange={(e) => setNewPlan(prev => ({ ...prev, remarks: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-md text-xs"
                placeholder="Optional remarks"
              />
            </FormControl>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <FormControl label="Default Start Date">
              <input 
                type="date" 
                value={newPlan.startDate} 
                onChange={(e) => setNewPlan(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-md text-xs"
              />
            </FormControl>
            <FormControl label="Default End Date">
              <input 
                type="date" 
                value={newPlan.endDate} 
                onChange={(e) => setNewPlan(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-md text-xs"
              />
            </FormControl>
          </div>

          <div className="">
            <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Select Items for Production</h3>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-[10px] text-slate-500 uppercase">
                    <th className="p-2 w-10">Select</th>
                    <th className="p-2">Project</th>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Pending Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedOrderDetails ? selectedOrderDetails.items : readyItems).map(item => {
                    const salesOrderItemId = item.id || item.sales_order_item_id;
                    const salesOrderId = item.sales_order_id;
                    const isSelected = newPlan.items.some(i => i.salesOrderItemId === salesOrderItemId);
                    
                    return (
                      <tr key={salesOrderItemId} className="hover:bg-slate-50">
                        <td className="p-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            disabled={item.status === 'Rejected'}
                            onChange={() => toggleItemSelection({
                              ...item,
                              sales_order_item_id: salesOrderItemId,
                              sales_order_id: salesOrderId,
                              project_name: item.project_name || selectedOrderDetails?.project_name
                            })}
                            className={`rounded border-slate-300 text-indigo-600 ${item.status === 'Rejected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </td>
                        <td className="p-2 font-medium">{item.project_name || selectedOrderDetails?.project_name}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-bold text-indigo-600">{item.item_code}</div>
                            {item.status === 'Rejected' && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-100 text-rose-600 animate-pulse uppercase border border-rose-200">
                                Rejected Drawing
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{item.description}</div>
                          {item.status === 'Rejected' && item.rejection_reason && (
                            <div className="text-[9px] text-rose-500 mt-0.5 italic">
                              Reason: {item.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center font-semibold text-slate-700">
                          {(item.total_qty || item.quantity) - (item.already_planned_qty || 0)} {item.unit}
                        </td>
                      </tr>
                    );
                  })}
                  {((selectedOrderDetails ? selectedOrderDetails.items : readyItems).length === 0) && (
                    <tr><td colSpan="4" className="p-4 text-center text-slate-400 italic">No items ready for production</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {newPlan.items.length > 0 && (
            <div className="">
              <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Plan Details</h3>
              <div className="space-y-4 mt-4">
                {newPlan.items.map((item, index) => (
                  <div key={item.salesOrderItemId} className="p-3 border rounded-lg bg-slate-50/50 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                          {item.itemCode}
                        </span>
                        <h4 className="text-xs font-medium text-slate-800 mt-1">{item.projectName}</h4>
                      </div>
                      <button 
                        type="button"
                        onClick={() => toggleItemSelection({ sales_order_item_id: item.salesOrderItemId })}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <FormControl label="Plan Qty">
                        <input 
                          type="number" 
                          value={item.plannedQty} 
                          onChange={(e) => handleItemChange(index, 'plannedQty', parseFloat(e.target.value))}
                          className="px-2 py-1.5 border border-slate-200 rounded text-xs"
                          max={item.totalQty - item.alreadyPlannedQty}
                          min="0.001"
                          step="0.001"
                          required
                        />
                      </FormControl>
                      <FormControl label="Workstation">
                        <select 
                          value={item.workstationId}
                          onChange={(e) => handleItemChange(index, 'workstationId', e.target.value)}
                          className="px-2 py-1.5 border border-slate-200 rounded text-xs"
                        >
                          <option value="">Select Workstation</option>
                          {workstations.map(ws => (
                            <option key={ws.id} value={ws.id}>{ws.workstation_name}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormControl label="Start Date">
                        <input 
                          type="date" 
                          value={item.plannedStartDate} 
                          onChange={(e) => handleItemChange(index, 'plannedStartDate', e.target.value)}
                          className="px-2 py-1.5 border border-slate-200 rounded text-xs"
                        />
                      </FormControl>
                      <FormControl label="End Date">
                        <input 
                          type="date" 
                          value={item.plannedEndDate} 
                          onChange={(e) => handleItemChange(index, 'plannedEndDate', e.target.value)}
                          className="px-2 py-1.5 border border-slate-200 rounded text-xs"
                        />
                      </FormControl>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 mt-2 border-t pt-2">
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase">Sub-assemblies</h5>
                        <ul className="text-[10px] text-slate-600 list-disc pl-4 mt-1">
                          {item.components?.map((c, i) => (
                            <li key={i}>{c.component_code} - {c.description} ({c.quantity} {c.uom})</li>
                          ))}
                          {(!item.components || item.components.length === 0) && <li className="list-none pl-0 italic text-slate-400">None</li>}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase">Raw Materials</h5>
                        <ul className="text-[10px] text-slate-600 list-disc pl-4 mt-1">
                          {item.materials?.map((m, i) => (
                            <li key={i}>{m.material_name} ({m.qty_per_pc} {m.uom})</li>
                          ))}
                          {(!item.materials || item.materials.length === 0) && <li className="list-none pl-0 italic text-slate-400">None</li>}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase">Operations</h5>
                        <ul className="text-[10px] text-slate-600 list-disc pl-4 mt-1">
                          {item.operations?.map((o, i) => (
                            <li key={i}>{o.operation_name} ({o.workstation})</li>
                          ))}
                          {(!item.operations || item.operations.length === 0) && <li className="list-none pl-0 italic text-slate-400">None</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
            >
              Create Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductionPlan;
