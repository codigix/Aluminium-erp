import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { TrendingUp, Package, Users, DollarSign } from 'lucide-react'
import Card from '../../components/Card/Card'
import Alert from '../../components/Alert/Alert'
import './Selling.css'

const styles = {
  mainContainer: {
    maxWidth: '100%',
    margin: '2rem',
    padding: '0'
  },
  header: {
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #e5e7eb'
  },
  gridRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  statCard: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  statIcon: {
    backgroundColor: '#f0f9ff',
    padding: '12px',
    borderRadius: '8px',
    color: '#0284c7'
  },
  statContent: {
    flex: 1
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#111'
  },
  filterSection: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px'
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '4px',
    color: '#374151'
  },
  input: {
    padding: '8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit'
  },
  select: {
    padding: '8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit',
    backgroundColor: 'white'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    marginTop: '16px'
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: '600',
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #d1d5db'
  },
  tableCell: {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginTop: '24px',
    marginBottom: '16px',
    color: '#111'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  }
}

export default function SalesOrderAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [boms, setBoms] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedBom, setSelectedBom] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')

  const [bomAnalysis, setBomAnalysis] = useState(null)
  const [customerAnalysis, setCustomerAnalysis] = useState(null)

  const [overallStats, setOverallStats] = useState({
    total_orders: 0,
    total_sales: 0,
    avg_order_value: 0,
    unique_customers: 0
  })

  useEffect(() => {
    fetchInitialData()
    fetchOverallStats()
  }, [])

  const fetchInitialData = async () => {
    try {
      const [bomRes, custRes] = await Promise.all([
        axios.get('http://localhost:5000/api/selling/bom-list').catch(() => ({ data: { data: [] } })),
        axios.get('http://localhost:5000/api/selling/customers').catch(() => ({ data: { data: [] } }))
      ])

      setBoms(bomRes.data.data || [])
      setCustomers(custRes.data.data || [])
    } catch (err) {
      console.error('Failed to fetch initial data:', err)
    }
  }

  const fetchOverallStats = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/selling/sales-orders')
      const orders = response.data.data || []

      const stats = {
        total_orders: orders.length,
        total_sales: orders.reduce((sum, o) => sum + (parseFloat(o.order_amount) || 0), 0),
        avg_order_value: orders.length > 0 
          ? orders.reduce((sum, o) => sum + (parseFloat(o.order_amount) || 0), 0) / orders.length
          : 0,
        unique_customers: new Set(orders.map(o => o.customer_id)).size
      }

      setOverallStats(stats)
    } catch (err) {
      console.error('Failed to fetch overall stats:', err)
    }
  }

  const handleBomAnalysis = async (e) => {
    e.preventDefault()
    if (!selectedBom) {
      setError('Please select a BOM')
      return
    }

    try {
      setLoading(true)
      const response = await axios.get(`http://localhost:5000/api/selling/orders-by-bom/${selectedBom}`)
      setBomAnalysis(response.data.data)
      setCustomerAnalysis(null)
      setError(null)
    } catch (err) {
      setError('Failed to fetch BOM analysis')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerAnalysis = async (e) => {
    e.preventDefault()
    if (!selectedCustomer) {
      setError('Please select a customer')
      return
    }

    try {
      setLoading(true)
      const response = await axios.get(`http://localhost:5000/api/selling/orders-by-customer/${selectedCustomer}`)
      setCustomerAnalysis(response.data.data)
      setBomAnalysis(null)
      setError(null)
    } catch (err) {
      setError('Failed to fetch customer analysis')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.mainContainer}>
      <Card>
        <div style={styles.header}>
          <h2>Sales Order Analysis</h2>
          <p style={{ color: '#666', marginTop: '8px' }}>Comprehensive analytics and insights for sales orders linked with BOMs</p>
        </div>

        {error && <Alert type="danger">{error}</Alert>}

        <h3 style={styles.sectionTitle}>Overall Statistics</h3>
        <div style={styles.gridRow}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <Package size={24} />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>Total Orders</div>
              <div style={styles.statValue}>{overallStats.total_orders}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <DollarSign size={24} />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>Total Sales</div>
              <div style={styles.statValue}>₹{overallStats.total_sales.toFixed(2)}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <TrendingUp size={24} />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>Avg Order Value</div>
              <div style={styles.statValue}>₹{overallStats.avg_order_value.toFixed(2)}</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <Users size={24} />
            </div>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>Unique Customers</div>
              <div style={styles.statValue}>{overallStats.unique_customers}</div>
            </div>
          </div>
        </div>

        <h3 style={styles.sectionTitle}>BOM-wise Analysis</h3>
        <div style={styles.filterSection}>
          <form onSubmit={handleBomAnalysis}>
            <div style={styles.filterRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Select BOM *</label>
                <select
                  style={styles.select}
                  value={selectedBom}
                  onChange={(e) => setSelectedBom(e.target.value)}
                  required
                >
                  <option value="">Choose a BOM...</option>
                  {boms.map(b => (
                    <option key={b.bom_id} value={b.bom_id}>
                      {b.product_name} ({b.bom_id})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '0' }}>
                <button type="submit" style={styles.button} disabled={loading}>
                  {loading ? 'Loading...' : 'Analyze'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {bomAnalysis && (
          <div>
            <div style={styles.gridRow}>
              {bomAnalysis.summary && bomAnalysis.summary.length > 0 ? (
                bomAnalysis.summary.map((stat, idx) => (
                  <div key={idx} style={styles.statCard}>
                    <div style={styles.statContent}>
                      <div style={styles.statLabel}>{stat.status.toUpperCase()}</div>
                      <div style={styles.statValue}>{stat.total_orders} orders</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        ₹{(stat.total_amount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Alert type="info">No orders found for this BOM</Alert>
              )}
            </div>

            {bomAnalysis.recent_orders && bomAnalysis.recent_orders.length > 0 && (
              <div>
                <h4 style={{ marginTop: '20px', marginBottom: '12px' }}>Recent Orders</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.tableHeader}>Order ID</th>
                        <th style={styles.tableHeader}>Customer</th>
                        <th style={styles.tableHeader}>Amount</th>
                        <th style={styles.tableHeader}>Quantity</th>
                        <th style={styles.tableHeader}>Status</th>
                        <th style={styles.tableHeader}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomAnalysis.recent_orders.map((order, idx) => (
                        <tr key={idx}>
                          <td style={styles.tableCell}>{order.sales_order_id}</td>
                          <td style={styles.tableCell}>{order.customer_id}</td>
                          <td style={styles.tableCell}>₹{order.order_amount}</td>
                          <td style={styles.tableCell}>{order.quantity}</td>
                          <td style={styles.tableCell}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              backgroundColor: order.status === 'confirmed' ? '#dcfce7' : '#fef3c7',
                              color: order.status === 'confirmed' ? '#166534' : '#92400e',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              {order.status}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <h3 style={styles.sectionTitle}>Customer-wise Analysis</h3>
        <div style={styles.filterSection}>
          <form onSubmit={handleCustomerAnalysis}>
            <div style={styles.filterRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Customer *</label>
                <select
                  style={styles.select}
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  required
                >
                  <option value="">Choose a customer...</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.name} ({c.customer_id})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '0' }}>
                <button type="submit" style={styles.button} disabled={loading}>
                  {loading ? 'Loading...' : 'Analyze'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {customerAnalysis && (
          <div>
            {customerAnalysis.summary && customerAnalysis.summary.length > 0 ? (
              <div>
                <div style={styles.gridRow}>
                  {customerAnalysis.summary.map((stat, idx) => (
                    <div key={idx} style={styles.statCard}>
                      <div style={styles.statContent}>
                        <div style={styles.statLabel}>
                          {new Date(stat.order_date).toLocaleDateString()} - {stat.status.toUpperCase()}
                        </div>
                        <div style={styles.statValue}>{stat.total_orders} orders</div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          ₹{(stat.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {customerAnalysis.orders && customerAnalysis.orders.length > 0 && (
                  <div>
                    <h4 style={{ marginTop: '20px', marginBottom: '12px' }}>All Orders</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.tableHeader}>Order ID</th>
                            <th style={styles.tableHeader}>BOM</th>
                            <th style={styles.tableHeader}>Amount</th>
                            <th style={styles.tableHeader}>Status</th>
                            <th style={styles.tableHeader}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerAnalysis.orders.map((order, idx) => (
                            <tr key={idx}>
                              <td style={styles.tableCell}>{order.sales_order_id}</td>
                              <td style={styles.tableCell}>{order.bom_id || 'N/A'}</td>
                              <td style={styles.tableCell}>₹{order.order_amount}</td>
                              <td style={styles.tableCell}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 8px',
                                  backgroundColor: order.status === 'confirmed' ? '#dcfce7' : '#fef3c7',
                                  color: order.status === 'confirmed' ? '#166534' : '#92400e',
                                  borderRadius: '4px',
                                  fontSize: '12px'
                                }}>
                                  {order.status}
                                </span>
                              </td>
                              <td style={styles.tableCell}>
                                {new Date(order.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Alert type="info">No orders found for this customer</Alert>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
