import { useState, useEffect } from 'react';
import { Card } from '../components/ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_HOST = API_BASE.replace(/\/api$/, '');

const statusColors = {
  CREATED: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', label: 'Created' },
  DESIGN_IN_REVIEW: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', label: 'Design Review' },
  DESIGN_APPROVED: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', label: 'Design Approved' },
  DESIGN_QUERY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', label: 'Design Query' },
  PROCUREMENT_IN_PROGRESS: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', label: 'Procurement Active' },
  MATERIAL_PURCHASE_IN_PROGRESS: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', label: 'Material Purchase' },
  MATERIAL_READY: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', label: 'Material Ready' },
  IN_PRODUCTION: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', label: 'In Production' },
  PRODUCTION_COMPLETED: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-600', label: 'Production Done' },
};

const priorityColors = {
  LOW: 'text-slate-500',
  NORMAL: 'text-slate-600',
  HIGH: 'text-red-600 font-bold',
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value, currency = 'INR') => {
  if (!value || isNaN(value)) return '—';
  const validCurrency = currency && ['USD', 'EUR', 'INR', 'GBP'].includes(currency.toUpperCase()) ? currency.toUpperCase() : 'INR';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: validCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatOrderCode = (id) => {
  return `SO-${String(id).padStart(4, '0')}`;
};

const MaterialTable = ({ itemId, itemQty, drawingNo }) => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    materialName: '',
    materialType: 'RAW',
    qtyPerPc: '',
    uom: 'KG'
  });

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/sales-orders/items/${itemId}/materials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [itemId]);

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/sales-orders/items/${itemId}/materials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newMaterial)
      });
      if (res.ok) {
        setShowAdd(false);
        setNewMaterial({ materialName: '', materialType: 'RAW', qtyPerPc: '', uom: 'KG' });
        fetchMaterials();
      }
    } catch (err) {
      console.error('Error adding material:', err);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!confirm('Delete this material?')) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/sales-orders/materials/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchMaterials();
    } catch (err) {
      console.error('Error deleting material:', err);
    }
  };

  return (
    <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Materials – Drawing {drawingNo || 'N/A'}
        </h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase"
        >
          {showAdd ? 'Cancel' : '+ Add Material'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddMaterial} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 bg-white p-3 rounded-lg border border-slate-200">
          <input
            placeholder="Material Name"
            className="text-xs p-2 border rounded"
            value={newMaterial.materialName}
            onChange={e => setNewMaterial({ ...newMaterial, materialName: e.target.value })}
            required
          />
          <select
            className="text-xs p-2 border rounded"
            value={newMaterial.materialType}
            onChange={e => setNewMaterial({ ...newMaterial, materialType: e.target.value })}
          >
            <option value="RAW">RAW</option>
            <option value="BOUGHT">BOUGHT</option>
            <option value="SERVICE">SERVICE</option>
            <option value="CONSUMABLE">CONSUMABLE</option>
          </select>
          <input
            type="number"
            step="0.0001"
            placeholder="Qty/Pc"
            className="text-xs p-2 border rounded"
            value={newMaterial.qtyPerPc}
            onChange={e => setNewMaterial({ ...newMaterial, qtyPerPc: e.target.value })}
            required
          />
          <input
            placeholder="UOM (KG/NOS)"
            className="text-xs p-2 border rounded"
            value={newMaterial.uom}
            onChange={e => setNewMaterial({ ...newMaterial, uom: e.target.value })}
            required
          />
          <button type="submit" className="bg-slate-900 text-white text-xs rounded font-bold uppercase">Save</button>
        </form>
      )}

      <table className="w-full text-left text-xs">
        <thead className="text-slate-400 uppercase tracking-tighter border-b border-slate-200">
          <tr>
            <th className="py-2">Material</th>
            <th className="py-2">Type</th>
            <th className="py-2 text-right">Qty/Pc</th>
            <th className="py-2 text-right">Total Qty</th>
            <th className="py-2">UOM</th>
            <th className="py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {materials.map(m => (
            <tr key={m.id}>
              <td className="py-2 font-medium text-slate-700">{m.material_name}</td>
              <td className="py-2"><span className="px-1.5 py-0.5 bg-slate-200 rounded text-[9px] font-bold">{m.material_type}</span></td>
              <td className="py-2 text-right font-mono">{parseFloat(m.qty_per_pc).toFixed(3)}</td>
              <td className="py-2 text-right font-bold text-indigo-600 font-mono">{(parseFloat(m.qty_per_pc) * itemQty).toFixed(3)}</td>
              <td className="py-2 uppercase text-slate-500">{m.uom}</td>
              <td className="py-2 text-right">
                <button onClick={() => handleDeleteMaterial(m.id)} className="text-red-400 hover:text-red-600">✕</button>
              </td>
            </tr>
          ))}
          {materials.length === 0 && (
            <tr>
              <td colSpan="6" className="py-4 text-center text-slate-400 italic">No materials added yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const SalesOrderRow = ({ order, userDepartment, onAction, actionLoading }) => {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  const currentStatus = statusColors[order.status] || statusColors.CREATED;
  const isProcessing = actionLoading === order.id;

  const fetchItems = async () => {
    if (items.length > 0) return;
    try {
      setLoadingItems(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/sales-orders/${order.id}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const toggleExpand = () => {
    const nextState = !expanded;
    setExpanded(nextState);
    if (nextState) fetchItems();
  };

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
        <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">{formatOrderCode(order.id)}</td>
        <td className="px-5 py-4">
          <p className="font-semibold text-slate-900">{order.company_name}</p>
          <p className="text-xs text-slate-400">{order.project_name || '—'}</p>
        </td>
        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{order.po_number || '—'}</td>
        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{formatDate(order.target_dispatch_date)}</td>
        <td className="px-5 py-4">
          <span className={`text-[10px] font-bold ${priorityColors[order.production_priority]}`}>
            {order.production_priority || 'NORMAL'}
          </span>
        </td>
        <td className="px-5 py-4">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${currentStatus.bg} ${currentStatus.border} ${currentStatus.text} uppercase whitespace-nowrap`}>
            {currentStatus.label}
          </span>
        </td>
        <td className="px-5 py-4 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={toggleExpand}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                expanded ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {expanded ? 'Hide Items' : 'View Items'}
            </button>
            <button
              onClick={() => onAction(order.id, 'accept')}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {isProcessing ? '...' : 'Accept'}
            </button>
            <button
              onClick={() => onAction(order.id, 'reject')}
              disabled={isProcessing}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="7" className="px-5 py-4 bg-slate-50/50">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Drawing List & BOM</h3>
              {loadingItems ? (
                <div className="py-4 text-center text-xs text-slate-400 italic">Loading items...</div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="border border-slate-100 rounded-lg overflow-hidden">
                      <div className="p-3 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-xs font-bold text-slate-900">{item.item_code || 'No Drawing'}</span>
                          <span className="text-xs text-slate-600 font-medium">{item.description}</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                             {parseFloat(item.quantity).toFixed(0)} {item.unit}
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                        >
                          {expandedItem === item.id ? 'Close BOM' : 'View BOM'}
                        </button>
                      </div>
                      {expandedItem === item.id && (
                        <div className="p-3">
                          <MaterialTable itemId={item.id} itemQty={parseFloat(item.quantity)} drawingNo={item.item_code} />
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-center py-2 text-xs text-slate-400">No drawings found</p>}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const IncomingOrders = ({ userDepartment = 'DESIGN_ENG' }) => {
  const [orders, setOrders] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const url = `${API_BASE}/sales-orders/incoming?department=${userDepartment}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching incoming orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userDepartment) fetchOrders();
  }, [userDepartment]);

  const handleAction = async (orderId, type) => {
    if (type === 'reject' && !confirm('Reject this order?')) return;
    try {
      setActionLoading(orderId);
      const token = localStorage.getItem('authToken');
      const endpoint = type === 'accept' ? 'accept' : 'reject';
      const response = await fetch(`${API_BASE}/sales-orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ departmentCode: userDepartment }),
      });
      if (response.ok) {
        setOrders(orders.filter(o => o.id !== orderId));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card id="incoming-orders" title="Incoming Orders" subtitle="Accept or reject incoming sales orders from upstream departments">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-500 uppercase tracking-[0.2em] text-[0.65rem]">
              <tr>
                <th className="px-5 py-4 text-left font-semibold">SO Code</th>
                <th className="px-5 py-4 text-left font-semibold">Customer / Project</th>
                <th className="px-5 py-4 text-left font-semibold">PO Number</th>
                <th className="px-5 py-4 text-left font-semibold">Dispatch Target</th>
                <th className="px-5 py-4 text-left font-semibold">Priority</th>
                <th className="px-5 py-4 text-left font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => (
                <SalesOrderRow 
                  key={order.id} 
                  order={order} 
                  userDepartment={userDepartment}
                  onAction={handleAction}
                  actionLoading={actionLoading}
                />
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-20 text-center text-slate-400 italic bg-white">
                    No incoming orders in your queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default IncomingOrders;
