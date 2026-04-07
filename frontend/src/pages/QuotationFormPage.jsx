import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, Trash2, Save, X, Send, 
  FileText, Calendar, User, Hash, 
  ChevronLeft, Loader2, Calculator,
  Building2, Mail, Phone, MapPin
} from 'lucide-react';
import { Card, StatusBadge, SearchableSelect } from '../components/ui.jsx';
import { successToast, errorToast } from '../utils/toast';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000');

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

const QuotationFormPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { initialData } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotationNo, setQuotationNo] = useState('Generating...');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState([]);
  const [drawings, setDrawings] = useState([]);

  useEffect(() => {
    fetchClients();
    fetchDrawings();
    generateQuotationNo();
    
    if (initialData) {
      setSelectedClient({
        id: initialData.clientId,
        company_name: initialData.clientName,
        email: initialData.clientEmail,
        contact_person: initialData.contact_person,
        phone: initialData.phone,
        address: initialData.address
      });
      
      const mappedItems = (initialData.items || []).map(item => ({
        ...item,
        id: item.id || Date.now() + Math.random(),
        total: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
        gst_percentage: item.gst_percentage || 18,
        isManual: !item.drawing_id && !!item.drawing_no
      }));
      
      setItems(mappedItems);
      setNotes(initialData.notes || '');
    }
  }, [initialData]);

  useEffect(() => {
    if (items.length > 0 && drawings.length > 0) {
      const itemsWithDrawingIds = items.map(item => {
        if (!item.drawing_id && item.drawing_no) {
          const matchedDrawing = drawings.find(d => 
            String(d.drawing_no).trim().toLowerCase() === String(item.drawing_no).trim().toLowerCase()
          );
          if (matchedDrawing) {
            return { ...item, drawing_id: matchedDrawing.id };
          }
        }
        return item;
      });
      
      // Only update if something changed to avoid infinite loop
      const hasChanges = itemsWithDrawingIds.some((it, idx) => it.drawing_id !== items[idx].drawing_id);
      if (hasChanges) {
        setItems(itemsWithDrawingIds);
      }
    }
  }, [drawings]);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchDrawings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/drawings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDrawings(data);
      }
    } catch (error) {
      console.error('Error fetching drawings:', error);
    }
  };

  const generateQuotationNo = async () => {
    // In a real app, this would come from the backend
    // For now, we'll simulate it
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setQuotationNo(`QRT-${randomNum}`);
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      drawing_no: '',
      description: '',
      quantity: 1,
      unit: 'Nos',
      rate: 0,
      total: 0,
      gst_percentage: 18,
      isManual: false
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updatedItem.total = (parseFloat(updatedItem.quantity) || 0) * (parseFloat(updatedItem.rate) || 0);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  const calculateSummary = () => {
    const baseAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const gstAmount = items.reduce((sum, item) => {
      const itemTotal = parseFloat(item.total) || 0;
      const gstPercent = parseFloat(item.gst_percentage) || 18;
      return sum + (itemTotal * gstPercent / 100);
    }, 0);
    return {
      baseAmount,
      gstAmount,
      totalAmount: baseAmount + gstAmount
    };
  };

  const summary = calculateSummary();

  const handleSave = async (status = 'Draft') => {
    if (!selectedClient) {
      errorToast('Please select a client');
      return;
    }
    if (status === 'Sent' && !selectedClient?.email) {
      errorToast('Client email is required to send quotation');
      return;
    }
    if (items.length === 0) {
      errorToast('Please add at least one item');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');
      
      const quotationData = {
        clientId: selectedClient.id,
        clientName: selectedClient.company_name,
        clientEmail: selectedClient.email,
        items: items.map(item => ({
          salesOrderItemId: item.salesOrderItemId || null,
          orderId: item.orderId || null,
          drawing_no: item.drawing_no,
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || 'Nos',
          quotedPrice: parseFloat(item.rate) || 0,
          gst_percentage: parseFloat(item.gst_percentage) || 18,
          status: item.status || 'Sent',
          profit_percentage: 0
        })),
        totalAmount: summary.totalAmount,
        notes: notes,
        status: status === 'Draft' ? 'DRAFT' : 'SENT',
        emailRequired: status === 'Sent',
        quotation_no: quotationNo,
        date: quotationDate
      };

      const response = await fetch(`${API_BASE}/quotation-requests/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quotationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save quotation');
      }

      successToast(`Quotation ${status === 'Draft' ? 'saved as draft' : 'sent'} successfully`);
      navigate('/client-quotations');
    } catch (error) {
      errorToast(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-2 space-y-4 bg-slate-50 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-slate-500 mb-0.5">
            <button 
              onClick={() => navigate('/client-quotations')}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider">Sales / Quotations</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Create Quotation</h1>
          <p className="text-slate-500 text-[11px]">Professional Quotation Management</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/client-quotations')}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={() => handleSave('Draft')}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('Sent')}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send Quotation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section 1: Quotation Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <FileText size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Quotation Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash size={12} /> Quotation No
                </label>
                <input 
                  type="text" 
                  value={quotationNo}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} /> Quotation Date
                </label>
                <input 
                  type="date" 
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} /> Client Name
                </label>
                <SearchableSelect
                  options={clients}
                  value={selectedClient?.id || ''}
                  onChange={(val) => {
                    const client = clients.find(c => String(c.id) === String(val));
                    setSelectedClient(client ? {
                      id: client.id,
                      company_name: client.company_name,
                      email: client.email,
                      contact_person: client.contact_person,
                      phone: client.phone,
                      address: client.address
                    } : null);
                  }}
                  placeholder="Select Client"
                  labelField="company_name"
                  valueField="id"
                  subLabelField="email"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Status
                </label>
                <div className="flex items-center">
                  <StatusBadge status="Draft" />
                </div>
              </div>
            </div>

            {selectedClient && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <Mail size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Email</p>
                    <p className="text-xs text-slate-600">{selectedClient.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <Phone size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Phone</p>
                    <p className="text-xs text-slate-600">{selectedClient.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="p-1 bg-white rounded text-slate-400">
                    <MapPin size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Address</p>
                    <p className="text-xs text-slate-600 line-clamp-1">{selectedClient.address || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Section 2: Quotation Items */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Calculator size={16} />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Quotation Items</h2>
              </div>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="w-12 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">No.</th>
                    <th className="w-72 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Drawing & Description</th>
                    <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Qty</th>
                    <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Rate (₹)</th>
                    <th className="w-40 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Total (₹)</th>
                    <th className="w-20 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-10 text-center text-slate-400 text-xs italic">
                        No items added yet. Click "Add Item" to begin.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-medium text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 group">
                              <div className="flex-1">
                                {item.isManual ? (
                                  <input 
                                    type="text"
                                    placeholder="Drawing No..."
                                    value={item.drawing_no}
                                    onChange={(e) => handleItemChange(item.id, 'drawing_no', e.target.value)}
                                    className="w-full px-0 py-0 text-sm font-bold text-slate-900 border-none focus:ring-0 placeholder:text-slate-300 bg-transparent"
                                  />
                                ) : (
                                  <SearchableSelect
                                    options={drawings}
                                    value={item.drawing_id}
                                    onChange={(val) => {
                                      const drw = drawings.find(d => String(d.id) === String(val));
                                      const updatedItems = items.map(it => {
                                        if (it.id === item.id) {
                                          const newRate = drw?.rate || drw?.quotedPrice || drw?.bom_cost || it.rate || 0;
                                          return {
                                            ...it,
                                            drawing_id: val,
                                            drawing_no: drw?.drawing_no || '',
                                            description: drw?.description || '',
                                            rate: newRate,
                                            total: (parseFloat(it.quantity) || 0) * (parseFloat(newRate) || 0)
                                          };
                                        }
                                        return it;
                                      });
                                      setItems(updatedItems);
                                    }}
                                    placeholder="Select Drawing..."
                                    labelField="drawing_no"
                                    valueField="id"
                                    subLabelField="description"
                                    className="border-none p-0 focus-within:ring-0 shadow-none bg-transparent font-bold text-sm"
                                  />
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  const updatedItems = items.map(it => {
                                    if (it.id === item.id) {
                                      return { 
                                        ...it, 
                                        isManual: !it.isManual,
                                        drawing_id: '',
                                        drawing_no: '',
                                        description: '',
                                        rate: 0,
                                        total: 0
                                      };
                                    }
                                    return it;
                                  });
                                  setItems(updatedItems);
                                }}
                                title={item.isManual ? "Switch to Master" : "Manual Entry"}
                                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${item.isManual ? 'text-amber-500 bg-amber-50' : 'text-slate-400 bg-slate-50'}`}
                              >
                                <Hash size={12} />
                              </button>
                            </div>
                            
                            <textarea 
                              placeholder="Add item description..."
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              rows="1"
                              className="w-full px-0 py-0 text-[11px] text-slate-500 border-none focus:ring-0 resize-none bg-transparent placeholder:text-slate-300"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                            <span className="text-[10px] text-slate-400 font-medium">{item.unit || 'Nos'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                            className="w-full px-2 py-1 text-xs font-semibold text-indigo-600 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">
                          {formatCurrency(item.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Section 3: Summary / Calculation */}
        <div className="space-y-4">
          <Card className="p-5 sticky top-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Calculator size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Summary</h2>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Base Amount</span>
                <span className="text-slate-900 font-bold">{formatCurrency(summary.baseAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">GST (18%)</span>
                <span className="text-slate-900 font-bold">{formatCurrency(summary.gstAmount)}</span>
              </div>
              
              <div className="pt-3 mt-3 border-t border-slate-100">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                    <p className="text-xl font-black text-indigo-600 tracking-tight">{formatCurrency(summary.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional terms..."
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-24"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex gap-2">
                  <div className="text-amber-600 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                    PDF will be generated upon sending.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationFormPage;
