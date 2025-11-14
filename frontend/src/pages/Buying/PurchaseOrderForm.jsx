import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../../components/Card/Card'
import Button from '../../components/Button/Button'
import Input from '../../components/Input/Input'
import Badge from '../../components/Badge/Badge'
import './Buying.css'

export default function PurchaseOrderForm() {
  const { po_no } = useParams()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [po, setPo] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    items: []
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const method = po_no ? 'PUT' : 'POST'
      const url = po_no ? `http://localhost:5000/api/purchase-orders/${po_no}` : 'http://localhost:5000/api/purchase-orders'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(po)
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

  const calculateTotal = () => {
    return po.items.reduce((sum, item) => sum + (item.qty * item.rate), 0)
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
                onChange={(e) => setPo({ ...po, supplier_id: e.target.value })}
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
            <div className="space-y-3">
              {po.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-neutral-200 rounded-lg">
                  <select
                    className="px-2 py-1 border border-neutral-300 rounded text-sm"
                    value={item.item_code}
                    onChange={(e) => {
                      const newItems = [...po.items]
                      newItems[index].item_code = e.target.value
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

                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => {
                      const newItems = [...po.items]
                      newItems[index].qty = parseFloat(e.target.value) || 0
                      setPo({ ...po, items: newItems })
                    }}
                  />

                  <Input
                    type="text"
                    placeholder="UOM"
                    value={item.uom}
                    onChange={(e) => {
                      const newItems = [...po.items]
                      newItems[index].uom = e.target.value
                      setPo({ ...po, items: newItems })
                    }}
                  />

                  <Input
                    type="number"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) => {
                      const newItems = [...po.items]
                      newItems[index].rate = parseFloat(e.target.value) || 0
                      setPo({ ...po, items: newItems })
                    }}
                  />

                  <div className="text-right py-1">
                    <span className="font-medium">₹{(item.qty * item.rate).toLocaleString()}</span>
                  </div>

                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-neutral-200 text-right">
            <p className="text-lg font-semibold">
              Total: <span className="text-primary-600">₹{calculateTotal().toLocaleString()}</span>
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