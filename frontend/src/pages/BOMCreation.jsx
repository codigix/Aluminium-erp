import React, { useState, useEffect } from 'react';
import { Card, StatusBadge } from '../components/ui.jsx';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const BOMCreation = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  
  // Material Modal State
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemMaterials, setItemMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  const [materialFormData, setMaterialFormData] = useState({
    materialName: '',
    materialType: 'RAW',
    qtyPerPc: '',
    uom: 'KG'
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      // Fetch all sales orders and filter for those currently in the design phase
      const response = await fetch(`${API_BASE}/sales-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      // Filter for orders that are accepted and in design phase
      const designPhaseOrders = data.filter(order => 
        ['DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'DESIGN_QUERY'].includes(order.status)
      );
      setOrders(designPhaseOrders);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSelectOrder = async (order) => {
    try {
      setSelectedOrder(order);
      setItemsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/sales-orders/${order.id}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch order items');
      const data = await response.json();
      setOrderItems(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load order items', 'error');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleManageBOM = async (item) => {
    try {
      setSelectedItem(item);
      setShowMaterialModal(true);
      setMaterialsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/items/${item.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch materials');
      const data = await response.json();
      setItemMaterials(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to load materials', 'error');
    } finally {
      setMaterialsLoading(false);
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();

    if (!materialFormData.materialName.trim()) {
      return Swal.fire('Validation Error', 'Please enter a material name.', 'warning');
    }

    if (parseFloat(materialFormData.qtyPerPc) <= 0 || !materialFormData.qtyPerPc) {
      return Swal.fire('Validation Error', 'Quantity must be greater than zero.', 'warning');
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/items/${selectedItem.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(materialFormData)
      });

      if (!response.ok) throw new Error('Failed to add material');
      
      const result = await response.json();
      const newMaterial = {
        id: result.id,
        material_name: materialFormData.materialName,
        material_type: materialFormData.materialType,
        qty_per_pc: materialFormData.qtyPerPc,
        uom: materialFormData.uom,
        sales_order_item_id: selectedItem.id
      };
      
      const updatedMaterials = [...itemMaterials, newMaterial];
      setItemMaterials(updatedMaterials);
      
      // Update the main items list to reflect the count change
      setOrderItems(prevItems => prevItems.map(item => 
        item.id === selectedItem.id 
          ? { ...item, materials: updatedMaterials }
          : item
      ));

      setMaterialFormData({
        materialName: '',
        materialType: 'RAW',
        qtyPerPc: '',
        uom: 'KG'
      });
      Swal.fire('Success', 'Material added to BOM', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  const handleSubmitBOM = async () => {
    if (!selectedOrder) return;
    
    const result = await Swal.fire({
      title: 'Submit Final BOM?',
      text: "This will finalize the BOM for this order and send it for technical approval.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Submit BOM'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/sales-orders/${selectedOrder.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'BOM_SUBMITTED' })
        });

        if (!response.ok) throw new Error('Failed to submit BOM');
        
        Swal.fire('Submitted!', 'BOM has been submitted for approval.', 'success');
        setSelectedOrder(null);
        setOrderItems([]);
        fetchOrders();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/bom/materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete material');
      
      const updatedMaterials = itemMaterials.filter(m => m.id !== materialId);
      setItemMaterials(updatedMaterials);

      // Update the main items list
      setOrderItems(prevItems => prevItems.map(item => 
        item.id === selectedItem.id 
          ? { ...item, materials: updatedMaterials }
          : item
      ));

      Swal.fire('Deleted', 'Material removed from BOM', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">BOM Creation</h1>
          <p className="text-sm text-slate-500">Define Bill of Materials for order items</p>
        </div>
        <button 
          onClick={fetchOrders}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Active Design Orders</h2>
          <Card>
            <div className="divide-y divide-slate-100 max-h-[calc(100vh-250px)] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-slate-500">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No orders available for BOM creation</div>
              ) : (
                orders.map((order) => (
                  <div 
                    key={order.id} 
                    className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${selectedOrder?.id === order.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                    onClick={() => handleSelectOrder(order)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold text-slate-900">PO: {order.po_number || 'N/A'}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-sm font-medium text-slate-700 truncate">{order.company_name}</div>
                    <div className="text-xs text-slate-500 truncate">SO-{String(order.id).padStart(4, '0')} | {order.project_name}</div>
                    <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-wider">
                      Target: {order.target_dispatch_date ? new Date(order.target_dispatch_date).toLocaleDateString('en-IN') : '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Items List */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              {selectedOrder ? `Items for PO: ${selectedOrder.po_number} (SO-${String(selectedOrder.id).padStart(4, '0')})` : 'Select an order to view items'}
            </h2>
            {selectedOrder && (
              <button
                onClick={handleSubmitBOM}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Submit Final BOM
              </button>
            )}
          </div>
          <Card>
            {!selectedOrder ? (
              <div className="p-12 text-center text-slate-400 italic">
                Please select an order from the left sidebar to manage its BOM
              </div>
            ) : itemsLoading ? (
              <div className="p-12 text-center text-slate-500">Loading items...</div>
            ) : orderItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No items found for this order</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item / Dwg</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Materials</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900">{item.item_code || 'N/A'}</div>
                          <div className="text-xs text-indigo-600 font-medium">{item.drawing_no || 'No Drawing'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs text-slate-600 line-clamp-2 max-w-xs">{item.description}</div>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900 text-xs">{item.quantity}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{item.unit}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.materials?.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.materials?.length || 0} items
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => handleManageBOM(item)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                          >
                            Manage BOM
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Material Management Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-900/75 transition-opacity" onClick={() => setShowMaterialModal(false)}></div>
            
            <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden">
              <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Manage BOM: {selectedItem?.item_code}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-md">{selectedItem?.description}</p>
                </div>
                <button onClick={() => setShowMaterialModal(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleAddMaterial} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Material Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={materialFormData.materialName}
                      onChange={(e) => setMaterialFormData({...materialFormData, materialName: e.target.value})}
                      placeholder="e.g. Aluminium Profile"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                    <select 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={materialFormData.materialType}
                      onChange={(e) => setMaterialFormData({...materialFormData, materialType: e.target.value})}
                    >
                      <option value="RAW">Raw Material</option>
                      <option value="BOUGHT">Bought Out</option>
                      <option value="SERVICE">Service</option>
                      <option value="CONSUMABLE">Consumable</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty per Pc</label>
                    <input 
                      type="number" 
                      step="0.0001"
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={materialFormData.qtyPerPc}
                      onChange={(e) => setMaterialFormData({...materialFormData, qtyPerPc: e.target.value})}
                      placeholder="0.0000"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">UOM</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={materialFormData.uom}
                        onChange={(e) => setMaterialFormData({...materialFormData, uom: e.target.value})}
                        placeholder="KG"
                      />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                      Add
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Material Name</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Total Qty</th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">UOM</th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {materialsLoading ? (
                        <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500 italic">Loading materials...</td></tr>
                      ) : itemMaterials.length === 0 ? (
                        <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400 italic">No materials defined yet</td></tr>
                      ) : (
                        itemMaterials.map((mat) => (
                          <tr key={mat.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{mat.material_name}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{mat.material_type}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <div className="font-bold text-indigo-600">
                                {(parseFloat(mat.qty_per_pc || 0) * parseFloat(selectedItem?.quantity || 0)).toFixed(4)}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {parseFloat(mat.qty_per_pc || 0).toFixed(4)} / pc
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-center font-medium text-slate-500">{mat.uom}</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => handleDeleteMaterial(mat.id)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="p-2 bg-slate-50 border-t border-slate-100 text-right">
                <button 
                  onClick={() => setShowMaterialModal(false)}
                  className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMCreation;
