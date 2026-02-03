import React, { useState, useEffect } from 'react';
import { Card, Modal, FormControl, StatusBadge, SearchableSelect, DataTable } from '../components/ui.jsx';
import DrawingPreviewModal from '../components/DrawingPreviewModal.jsx';
import { Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { successToast, errorToast } from '../utils/toast';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

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
  const [availableBoms, setAvailableBoms] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  
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
    setAvailableBoms([]);
    setSelectedBomId('');
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
    setSelectedBomId('');
    setAvailableBoms([]);
    
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
        
        // Populate available BOMs from SO items
        const boms = data.items || [];
        setAvailableBoms(boms);
        
        // If only one BOM, auto-select it
        if (boms.length === 1) {
          const singleBomId = boms[0].id.toString();
          setSelectedBomId(singleBomId);
          // Auto-select the item for production if it's in readyItems
          const itemInReady = readyItems.find(ri => ri.sales_order_item_id === parseInt(singleBomId));
          if (itemInReady) {
            toggleItemSelection(itemInReady);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SO details:', error);
      errorToast('Failed to fetch sales order details');
    }
  };

  const handleBomSelect = (bomId) => {
    setSelectedBomId(bomId);
    if (!bomId) return;

    // When a BOM is selected, find the item in readyItems and select it
    const itemInReady = readyItems.find(ri => ri.sales_order_item_id === parseInt(bomId));
    if (itemInReady) {
      const exists = newPlan.items.find(i => i.salesOrderItemId === parseInt(bomId));
      if (!exists) {
        toggleItemSelection(itemInReady);
      }
    }
  };

  const toggleItemSelection = async (item) => {
    const salesOrderItemId = item.id || item.sales_order_item_id;
    const exists = newPlan.items.find(i => i.salesOrderItemId === salesOrderItemId);
    
    if (exists) {
      setNewPlan(prev => ({
        ...prev,
        items: prev.items.filter(i => i.salesOrderItemId !== salesOrderItemId)
      }));
    } else {
      // Fetch BOM details for this item
      let bomDetails = { materials: [], components: [], operations: [] };
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/production-plans/item-bom/${salesOrderItemId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          bomDetails = await response.json();
        }
      } catch (error) {
        console.error('Error fetching BOM details:', error);
      }

      setNewPlan(prev => ({
        ...prev,
        items: [...prev.items, {
          salesOrderId: item.sales_order_id,
          salesOrderItemId: salesOrderItemId,
          projectName: item.project_name,
          orderNo: item.order_no,
          itemCode: item.item_code,
          description: item.description,
          plannedQty: (item.total_qty || item.quantity) - (item.already_planned_qty || 0),
          totalQty: item.total_qty || item.quantity,
          alreadyPlannedQty: item.already_planned_qty || 0,
          workstationId: '',
          plannedStartDate: prev.startDate,
          plannedEndDate: prev.endDate,
          // Store fetched BOM details
          materials: bomDetails.materials || [],
          components: bomDetails.components || [],
          operations: bomDetails.operations || []
        }]
      }));
    }
  };

  const renderBOMItem = (comp, level = 0, parentQty = 1) => {
    const currentQty = comp.quantity * parentQty;
    return (
      <React.Fragment key={`${level}-${comp.id || comp.component_code}`}>
        <li className="list-disc ml-2">
          <span className="font-medium">{comp.component_code}</span> - {comp.description} ({(currentQty).toFixed(3)} {comp.uom})
          {((comp.materials && comp.materials.length > 0) || (comp.components && comp.components.length > 0) || (comp.operations && comp.operations.length > 0)) && (
            <ul className="pl-4 mt-1 border-l border-slate-200 space-y-1 mb-2">
              {comp.materials?.map((m, i) => (
                <li key={`m-${i}`} className="text-[9px] text-slate-500">
                  <span className="text-slate-400">└ Material:</span> {m.material_name} ({(m.qty_per_pc * currentQty).toFixed(3)} {m.uom})
                </li>
              ))}
              {comp.components?.map((c, i) => renderBOMItem(c, level + 1, currentQty))}
              {comp.operations?.map((o, i) => (
                <li key={`o-${i}`} className="text-[9px] text-slate-500">
                  <span className="text-slate-400">└ Op:</span> {o.operation_name} ({o.workstation})
                </li>
              ))}
            </ul>
          )}
        </li>
      </React.Fragment>
    );
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...newPlan.items];
    updatedItems[index][field] = value;
    setNewPlan(prev => ({ ...prev, items: updatedItems }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPlan.items.length === 0) {
      errorToast('Please select at least one item');
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
        successToast('Production plan created successfully');
        setIsModalOpen(false);
        fetchPlans();
      } else {
        const error = await response.json();
        errorToast(error.message || 'Failed to create production plan');
      }
    } catch (error) {
      errorToast('An unexpected error occurred');
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <FormControl label="Search Sales Order">
              <SearchableSelect 
                options={productionReadyOrders.map(so => ({
                  label: `${so.order_no} - ${so.company_name} ${so.project_name ? `(${so.project_name})` : ''}`,
                  value: so.id.toString()
                }))}
                value={selectedOrderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
                placeholder="Search and select sales order..."
                allowCustom={false}
              />
            </FormControl>

            <FormControl label="Select BOM">
              <select
                className={`w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white ${availableBoms.length <= 1 ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                value={selectedBomId}
                onChange={(e) => handleBomSelect(e.target.value)}
                disabled={availableBoms.length <= 1}
              >
                <option value="">{availableBoms.length === 0 ? 'No BOMs Available' : 'Select BOM...'}</option>
                {availableBoms.map(bom => (
                  <option key={bom.id} value={bom.id}>
                    {bom.item_code} - {bom.description} ({bom.drawing_no})
                  </option>
                ))}
              </select>
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
            <h3 className="text-sm  text-slate-900 border-b pb-2">Select Items for Production</h3>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-[10px] text-slate-500 ">
                    <th className="p-2 w-10">Select</th>
                    <th className="p-2">Order No</th>
                    <th className="p-2">Project</th>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Design Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedOrderDetails ? selectedOrderDetails.items : readyItems)
                    .filter(item => item.item_type === 'FG' || item.item_type === 'SFG' || !item.item_type)
                    .map(item => {
                    const salesOrderItemId = item.id || item.sales_order_item_id;
                    const salesOrderId = item.sales_order_id;
                    const isSelected = newPlan.items.some(i => i.salesOrderItemId === salesOrderItemId);
                    const orderNo = item.order_no || selectedOrderDetails?.order_no;
                    const projectName = item.project_name || selectedOrderDetails?.project_name;
                    
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
                              project_name: projectName,
                              order_no: orderNo
                            })}
                            className={`rounded border-slate-300 text-indigo-600 ${item.status === 'Rejected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </td>
                        <td className="p-2 font-medium text-slate-700">{orderNo || 'N/A'}</td>
                        <td className="p-2 text-slate-600 truncate max-w-[150px]">{projectName || 'N/A'}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="text-xs  text-indigo-600">{item.item_code}</div>
                            {item.status === 'Rejected' && (
                              <span className="px-1.5 py-0.5 rounded text-[8px]  bg-rose-100 text-rose-600 animate-pulse  border border-rose-200">
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
                        <td className="p-2 text-center  text-slate-700">
                          {item.total_qty || item.quantity} {item.unit}
                        </td>
                      </tr>
                    );
                  })}
                  {((selectedOrderDetails ? selectedOrderDetails.items : readyItems)
                    .filter(item => item.item_type === 'FG' || item.item_type === 'SFG' || !item.item_type).length === 0) && (
                    <tr><td colSpan="5" className="p-4 text-center text-slate-400 italic">No items ready for production</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {newPlan.items.length > 0 && (
            <div className="">
              <h3 className="text-sm  text-slate-900 border-b pb-2">Plan Details</h3>
              <div className="space-y-4 mt-4">
                {newPlan.items.map((item, index) => (
                  <div key={item.salesOrderItemId} className="p-3 border rounded-lg bg-slate-50/50 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px]  text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ">
                          {item.orderNo} | {item.itemCode}
                        </span>
                        <h4 className="text-xs font-medium text-slate-800 mt-1">{item.projectName || 'N/A'}</h4>
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
                        <h5 className="text-[10px]  text-slate-500 ">Sub-assemblies</h5>
                        <ul className="text-[10px] text-slate-600 list-disc pl-4 mt-1">
                          {item.components?.map((c, i) => renderBOMItem(c, 0, item.plannedQty || 0))}
                          {(!item.components || item.components.length === 0) && <li className="list-none pl-0 italic text-slate-400">None</li>}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-[10px]  text-slate-500 ">Raw Materials</h5>
                        <ul className="text-[10px] text-slate-600 list-disc pl-4 mt-1">
                          {item.materials?.map((m, i) => (
                            <li key={i}>{m.material_name} ({(m.qty_per_pc * (item.plannedQty || 0)).toFixed(3)} {m.uom})</li>
                          ))}
                          {(!item.materials || item.materials.length === 0) && <li className="list-none pl-0 italic text-slate-400">None</li>}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-[10px]  text-slate-500 ">Operations</h5>
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

