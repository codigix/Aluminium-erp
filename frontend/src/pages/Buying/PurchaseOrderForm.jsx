import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Input from '../../components/Input/Input'
import Badge from '../../components/Badge/Badge'
import { Trash2 } from 'lucide-react'
import './Buying.css'

export default function PurchaseOrderForm() {
  const { po_no } = useParams()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [po, setPo] = useState({
    supplier_id: '',
    supplier_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    items: [],
    tax_category: '',
    tax_rate: 0,
    shipping_rule: '',
    incoterm: '',
    advance_paid: 0,
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: '',
    payment_terms_description: '',
    due_date: '',
    invoice_portion: 100,
    payment_amount: 0
  })

  useEffect(() => {
    fetchSuppliers()
    fetchItems()
    if (po_no && po_no !== 'new') {
      fetchPO()
    }
  }, [po_no])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/suppliers')
      const data = await res.json()
      if (data.success) {
        setSuppliers(data.data)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId)
    setPo({ ...po, supplier_id: supplierId, supplier_name: supplier?.name || '' })
  }

  const fetchItems = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/items')
      const data = await res.json()
      if (data.success) {
        setItems(data.data)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  const fetchPO = async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/api/purchase-orders/${po_no}`)
      const data = await res.json()
      if (data.success) {
        setPo(data.data)
      }
    } catch (error) {
      console.error('Error fetching PO:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    setPo({
      ...po,
      items: [...po.items, { item_code: '', qty: 0, uom: 'PCS', rate: 0 }]
    })
  }

  const handleRemoveItem = (index) => {
    setPo({
      ...po,
      items: po.items.filter((_, i) => i !== index)
    })
  }

  const calculateSubtotal = () => {
    return po.items.reduce((sum, item) => sum + (item.qty * item.rate), 0)
  }

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal()
    return (subtotal * (po.tax_rate || 0)) / 100
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const taxAmount = calculateTaxAmount()
    return subtotal + taxAmount - (po.advance_paid || 0)
  }

  const getTotalQty = () => {
    return po.items.reduce((total, item) => total + (item.qty || 0), 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const method = po_no ? 'PUT' : 'POST'
      const url = po_no ? `http://localhost:5000/api/purchase-orders/${po_no}` : 'http://localhost:5000/api/purchase-orders'
      
      const submitData = {
        ...po,
        subtotal: calculateSubtotal(),
        tax_amount: calculateTaxAmount(),
        final_amount: calculateTotal(),
        accounting_emails: ['accounts@company.com']
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })
      
      const data = await res.json()
      if (data.success) {
        alert('Purchase Order saved successfully!')
        navigate('/buying/purchase-orders')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex-between mb-6">
        <h2 className="text-3xl font-bold text-neutral-900">
          {po_no ? 'Edit Purchase Order' : 'Create Purchase Order'}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card className="mb-6">
          <h3 className="text-xl font-semibold mb-4">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Supplier</label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                value={po.supplier_id}
                onChange={(e) => handleSupplierChange(e.target.value)}
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map(sup => (
                  <option key={sup.supplier_id} value={sup.supplier_id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Order Date</label>
              <Input
                type="date"
                value={po.order_date}
                onChange={(e) => setPo({ ...po, order_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Expected Date</label>
              <Input
                type="date"
                value={po.expected_date}
                onChange={(e) => setPo({ ...po, expected_date: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <div className="flex-between mb-4">
            <h3 className="text-xl font-semibold">Items</h3>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
              Add Item
            </Button>
          </div>

          {po.items.length === 0 ? (
            <p className="text-neutral-500">No items added yet</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#f5f5f5' }}>
                  <tr>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Item</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '80px' }}>Qty</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '80px' }}>UOM</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '100px' }}>Rate</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '120px' }}>Amount</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '70px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px' }}>
                        <select
                          className="px-2 py-1 border border-neutral-300 rounded text-sm w-full"
                          value={item.item_code}
                          onChange={(e) => {
                            const newItems = [...po.items]
                            const selectedItem = items.find(i => i.item_code === e.target.value)
                            newItems[index] = {
                              ...newItems[index],
                              item_code: e.target.value,
                              uom: selectedItem?.uom || 'PCS'
                            }
                            setPo({ ...po, items: newItems })
                          }}
                        >
                          <option value="">Select Item</option>
                          {items.map(itm => (
                            <option key={itm.item_code} value={itm.item_code}>
                              {itm.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...po.items]
                            newItems[index].qty = parseFloat(e.target.value) || 0
                            setPo({ ...po, items: newItems })
                          }}
                          style={{ textAlign: 'center' }}
                        />
                      </td>

                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Input
                          type="text"
                          placeholder="UOM"
                          value={item.uom}
                          onChange={(e) => {
                            const newItems = [...po.items]
                            newItems[index].uom = e.target.value
                            setPo({ ...po, items: newItems })
                          }}
                          style={{ textAlign: 'center' }}
                        />
                      </td>

                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Input
                          type="number"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => {
                            const newItems = [...po.items]
                            newItems[index].rate = parseFloat(e.target.value) || 0
                            setPo({ ...po, items: newItems })
                          }}
                          style={{ textAlign: 'center' }}
                        />
                      </td>

                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, backgroundColor: '#f0fdf4', color: '#166534' }}>
                        ₹{(item.qty * item.rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Items Summary */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Total Items</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>
                {po.items.length}
              </p>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Total Quantity</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>
                {getTotalQty().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Subtotal Amount</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0284c7' }}>
                ₹{calculateSubtotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        {/* Tax & Charges Section */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Tax & Charges</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tax Category</label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                value={po.tax_category}
                onChange={(e) => setPo({ ...po, tax_category: e.target.value })}
              >
                <option value="">Select Tax Category</option>
                <option value="GST">GST</option>
                <option value="VAT">VAT</option>
                <option value="ST">Service Tax</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tax Rate (%)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={po.tax_rate}
                onChange={(e) => setPo({ ...po, tax_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tax Amount</label>
              <div style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                fontWeight: 600,
                fontSize: '0.95rem'
              }}>
                ₹{calculateTaxAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Shipping Rule</label>
              <Input
                type="text"
                placeholder="e.g., FOB, CIF"
                value={po.shipping_rule}
                onChange={(e) => setPo({ ...po, shipping_rule: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Incoterm</label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                value={po.incoterm}
                onChange={(e) => setPo({ ...po, incoterm: e.target.value })}
              >
                <option value="">Select Incoterm</option>
                <option value="EXW">EXW - Ex Works</option>
                <option value="FCA">FCA - Free Carrier</option>
                <option value="FAS">FAS - Free Alongside Ship</option>
                <option value="FOB">FOB - Free on Board</option>
                <option value="CFR">CFR - Cost and Freight</option>
                <option value="CIF">CIF - Cost, Insurance & Freight</option>
                <option value="DAP">DAP - Delivered at Place</option>
                <option value="DDP">DDP - Delivered Duty Paid</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Advance Paid (₹)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={po.advance_paid}
                onChange={(e) => setPo({ ...po, advance_paid: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Advance Paid</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 600, color: '#374151' }}>
                  ₹{(po.advance_paid || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Final Amount Summary */}
        <Card className="mb-6" style={{ backgroundColor: '#ecfdf5', borderLeft: '4px solid #10b981' }}>
          <h3 className="text-lg font-semibold mb-4">Final Amount</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Subtotal</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669' }}>
                ₹{calculateSubtotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Tax ({po.tax_rate || 0}%)</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669' }}>
                ₹{calculateTaxAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>Final Amount (After Advance)</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#059669' }}>
                ₹{calculateTotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        {/* Shipping Address Section */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Shipping Address</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Address Line 1</label>
              <Input
                type="text"
                placeholder="Street address"
                value={po.shipping_address_line1}
                onChange={(e) => setPo({ ...po, shipping_address_line1: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Address Line 2</label>
              <Input
                type="text"
                placeholder="Apartment, suite, etc."
                value={po.shipping_address_line2}
                onChange={(e) => setPo({ ...po, shipping_address_line2: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">City</label>
              <Input
                type="text"
                placeholder="City"
                value={po.shipping_city}
                onChange={(e) => setPo({ ...po, shipping_city: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">State</label>
              <Input
                type="text"
                placeholder="State/Province"
                value={po.shipping_state}
                onChange={(e) => setPo({ ...po, shipping_state: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pincode</label>
              <Input
                type="text"
                placeholder="Postal code"
                value={po.shipping_pincode}
                onChange={(e) => setPo({ ...po, shipping_pincode: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Country</label>
              <Input
                type="text"
                placeholder="Country"
                value={po.shipping_country}
                onChange={(e) => setPo({ ...po, shipping_country: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Payment Terms Section */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Payment Terms</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Payment Terms Description</label>
              <Input
                type="text"
                placeholder="e.g., Net 30, Net 60, etc."
                value={po.payment_terms_description}
                onChange={(e) => setPo({ ...po, payment_terms_description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Due Date</label>
              <Input
                type="date"
                value={po.due_date}
                onChange={(e) => setPo({ ...po, due_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Invoice Portion (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="100"
                value={po.invoice_portion}
                onChange={(e) => setPo({ ...po, invoice_portion: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Payment Amount (₹)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={po.payment_amount}
                onChange={(e) => setPo({ ...po, payment_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#fef3c7', 
            borderLeft: '4px solid #f59e0b',
            borderRadius: '4px',
            marginTop: '12px'
          }}>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>
              💡 Payment Reminder: Due date {po.due_date ? `(${new Date(po.due_date).toLocaleDateString('en-IN')})` : '(not set)'} - Reminders will be sent to Accounts Department
            </p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save PO'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/buying/purchase-orders')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
