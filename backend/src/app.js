import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

const app = express()

const corsOrigin = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || '*'
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(origin => origin.trim()),
    credentials: true
  })
)
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aluminium_erp',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0
})

const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params)
  return rows
}

const asyncHandler = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

app.get(
  '/health',
  asyncHandler(async (req, res) => {
    await query('SELECT 1')
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
)

app.get(
  '/api/stock/warehouses',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT w.id AS warehouse_id,
              w.warehouse_code,
              w.warehouse_name,
              w.warehouse_type,
              w.location,
              w.capacity,
              w.is_active,
              w.created_at,
              w.updated_at
         FROM warehouses w
        ORDER BY w.warehouse_name ASC`
    )
    res.json({ data: rows })
  })
)

app.get(
  '/api/stock/stock-balance',
  asyncHandler(async (req, res) => {
    const { warehouse_id: warehouseId, item_code: itemCode } = req.query
    const filters = []
    const values = []
    if (warehouseId) {
      filters.push('sb.warehouse_id = ?')
      values.push(Number(warehouseId))
    }
    if (itemCode) {
      filters.push('sb.item_code = ?')
      values.push(itemCode)
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const rows = await query(
      `SELECT sb.id,
              sb.item_code,
              sb.warehouse_id,
              sb.current_qty,
              sb.reserved_qty,
              sb.available_qty,
              sb.valuation_rate,
              sb.total_value,
              sb.updated_at,
              w.warehouse_name,
              w.warehouse_code,
              w.location,
              i.name AS item_name,
              i.uom,
              i.lead_time_days,
              i.safety_stock,
              i.standard_selling_rate
         FROM stock_balance sb
         LEFT JOIN warehouses w ON w.id = sb.warehouse_id
         LEFT JOIN item i ON i.item_code = sb.item_code
        ${whereClause}
        ORDER BY sb.updated_at DESC
        LIMIT 300`,
      values
    )
    res.json({ data: rows })
  })
)

app.get(
  '/api/stock/ledger',
  asyncHandler(async (req, res) => {
    const { warehouse_id: warehouseId, item_code: itemCode, from_date: fromDate, to_date: toDate } = req.query
    const filters = []
    const values = []
    if (warehouseId) {
      filters.push('sl.warehouse_id = ?')
      values.push(Number(warehouseId))
    }
    if (itemCode) {
      filters.push('sl.item_code = ?')
      values.push(itemCode)
    }
    if (fromDate) {
      filters.push('sl.transaction_date >= ?')
      values.push(fromDate)
    }
    if (toDate) {
      filters.push('sl.transaction_date <= ?')
      values.push(`${toDate} 23:59:59`)
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const rows = await query(
      `SELECT sl.id,
              sl.item_code,
              sl.warehouse_id,
              sl.transaction_date,
              sl.transaction_type,
              sl.qty_in,
              sl.qty_out,
              sl.balance_qty,
              sl.valuation_rate,
              sl.transaction_value,
              sl.reference_doctype,
              sl.reference_name,
              sl.remarks,
              w.warehouse_name,
              i.name AS item_name
         FROM stock_ledger sl
         LEFT JOIN warehouses w ON w.id = sl.warehouse_id
         LEFT JOIN item i ON i.item_code = sl.item_code
        ${whereClause}
        ORDER BY sl.transaction_date DESC
        LIMIT 300`,
      values
    )
    res.json({ data: rows })
  })
)

app.get(
  '/api/stock/entries',
  asyncHandler(async (req, res) => {
    const entries = await query(
      `SELECT se.id,
              se.entry_no,
              se.entry_date,
              se.entry_type,
              se.from_warehouse_id,
              se.to_warehouse_id,
              se.status,
              se.reference_doctype,
              se.reference_name,
              se.total_qty,
              se.total_value,
              se.remarks,
              fw.warehouse_name AS from_warehouse_name,
              tw.warehouse_name AS to_warehouse_name
         FROM stock_entries se
         LEFT JOIN warehouses fw ON fw.id = se.from_warehouse_id
         LEFT JOIN warehouses tw ON tw.id = se.to_warehouse_id
        ORDER BY se.entry_date DESC
        LIMIT 50`
    )
    if (!entries.length) {
      return res.json({ data: [] })
    }
    const placeholders = entries.map(() => '?').join(',')
    const items = await query(
      `SELECT sei.id,
              sei.stock_entry_id,
              sei.item_code,
              sei.qty,
              sei.uom,
              sei.valuation_rate,
              sei.transaction_value,
              i.name AS item_name
         FROM stock_entry_items sei
         LEFT JOIN item i ON i.item_code = sei.item_code
        WHERE sei.stock_entry_id IN (${placeholders})`,
      entries.map(entry => entry.id)
    )
    const groupedItems = items.reduce((acc, item) => {
      if (!acc[item.stock_entry_id]) {
        acc[item.stock_entry_id] = []
      }
      acc[item.stock_entry_id].push(item)
      return acc
    }, {})
    const data = entries.map(entry => ({
      ...entry,
      items: groupedItems[entry.id] || []
    }))
    res.json({ data })
  })
)

app.get(
  '/api/stock/transfers',
  asyncHandler(async (req, res) => {
    const transfers = await query(
      `SELECT mt.id,
              mt.transfer_no,
              mt.transfer_date,
              mt.status,
              mt.reference_doctype,
              mt.reference_name,
              mt.remarks,
              fw.warehouse_name AS from_warehouse,
              tw.warehouse_name AS to_warehouse
         FROM material_transfers mt
         LEFT JOIN warehouses fw ON fw.id = mt.from_warehouse_id
         LEFT JOIN warehouses tw ON tw.id = mt.to_warehouse_id
        ORDER BY mt.transfer_date DESC
        LIMIT 50`
    )
    if (!transfers.length) {
      return res.json({ data: [] })
    }
    const placeholders = transfers.map(() => '?').join(',')
    const items = await query(
      `SELECT mti.material_transfer_id,
              mti.item_code,
              mti.qty,
              mti.uom,
              i.name AS item_name
         FROM material_transfer_items mti
         LEFT JOIN item i ON i.item_code = mti.item_code
        WHERE mti.material_transfer_id IN (${placeholders})`,
      transfers.map(entry => entry.id)
    )
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.material_transfer_id]) {
        acc[item.material_transfer_id] = []
      }
      acc[item.material_transfer_id].push(item)
      return acc
    }, {})
    const data = transfers.map(entry => ({
      ...entry,
      item_count: grouped[entry.id]?.length || 0,
      items: grouped[entry.id] || []
    }))
    res.json({ data })
  })
)

app.get(
  '/api/stock/batches',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT bt.id,
              bt.batch_no,
              bt.item_code,
              bt.manufacturing_date,
              bt.expiry_date,
              bt.warehouse_id,
              bt.current_qty,
              bt.status,
              w.warehouse_name,
              i.name AS item_name
         FROM batch_tracking bt
         LEFT JOIN warehouses w ON w.id = bt.warehouse_id
         LEFT JOIN item i ON i.item_code = bt.item_code
        ORDER BY bt.manufacturing_date DESC
        LIMIT 100`
    )
    res.json({ data: rows })
  })
)

app.get(
  '/api/stock/reconciliations',
  asyncHandler(async (req, res) => {
    const records = await query(
      `SELECT sr.id,
              sr.reconciliation_no,
              sr.reconciliation_date,
              sr.warehouse_id,
              sr.purpose,
              sr.status,
              sr.total_items,
              sr.remarks,
              w.warehouse_name
         FROM stock_reconciliation sr
         LEFT JOIN warehouses w ON w.id = sr.warehouse_id
        ORDER BY sr.reconciliation_date DESC
        LIMIT 50`
    )
    if (!records.length) {
      return res.json({ data: [] })
    }
    const placeholders = records.map(() => '?').join(',')
    const items = await query(
      `SELECT sri.stock_reconciliation_id,
              sri.item_code,
              sri.system_qty,
              sri.physical_qty,
              sri.difference,
              sri.variance_percentage,
              i.name AS item_name
         FROM stock_reconciliation_items sri
         LEFT JOIN item i ON i.item_code = sri.item_code
        WHERE sri.stock_reconciliation_id IN (${placeholders})`,
      records.map(record => record.id)
    )
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.stock_reconciliation_id]) {
        acc[item.stock_reconciliation_id] = []
      }
      acc[item.stock_reconciliation_id].push(item)
      return acc
    }, {})
    const data = records.map(record => ({
      ...record,
      items: grouped[record.id] || []
    }))
    res.json({ data })
  })
)

app.use((err, req, res, next) => {
  console.error('[Inventory API Error]', err)
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' })
})

const PORT = Number(process.env.PORT) || 5000

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
})

export default app
export { server }
