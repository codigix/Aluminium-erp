import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createPool } from 'mysql2/promise'
import authRoutes from './routes/auth.js'
import supplierRoutes from './routes/suppliers.js'
import itemRoutes from './routes/items.js'
import materialRequestRoutes from './routes/materialRequests.js'
import rfqRoutes from './routes/rfqs.js'
import quotationRoutes from './routes/quotations.js'
import purchaseOrderRoutes from './routes/purchaseOrders.js'
import purchaseReceiptRoutes from './routes/purchaseReceipts.js'
import purchaseInvoiceRoutes from './routes/purchaseInvoices.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import stockWarehouseRoutes from './routes/stockWarehouses.js'
import stockBalanceRoutes from './routes/stockBalance.js'
import stockLedgerRoutes from './routes/stockLedger.js'
import stockEntryRoutes from './routes/stockEntries.js'
import materialTransferRoutes from './routes/materialTransfers.js'
import batchTrackingRoutes from './routes/batchTracking.js'
import stockReconciliationRoutes from './routes/stockReconciliation.js'
import reorderManagementRoutes from './routes/reorderManagement.js'
import { createProductionRoutes } from './routes/production.js'
import { createToolRoomRoutes } from './routes/toolroom.js'
import { createQCRoutes } from './routes/qc.js'
import { createDispatchRoutes } from './routes/dispatch.js'
import { createHRPayrollRoutes } from './routes/hrpayroll.js'
import { createFinanceRoutes } from './routes/finance.js'
import sellingRoutes from './routes/selling.js'
import grnRequestRoutes from './routes/grnRequests.js'
import companyRoutes from './routes/company.js'
import taxTemplateRoutes from './routes/taxTemplates.js'
import setupMasterDataRoutes from './routes/setup.js'
import crmRoutes from './routes/crm.js'
import { SetupModel } from './models/SetupModel.js'

// Load environment variables
dotenv.config()

const app = express()

// CORS Configuration - Handle multiple origins properly
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001']

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS not allowed for this origin'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Database pool
let db = null

async function initializeDatabase() {
  try {
    db = createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'aluminium_erp',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })

    // Test the database connection
    await db.execute('SELECT 1')
    console.log('✓ Database connected successfully')

    // Store db in app locals for route handlers
    app.locals.db = db

    // Make db available globally for models
    global.db = db

    console.log('✓ Database pool created successfully')

    // Create sales_order_items table if it doesn't exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sales_order_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sales_order_id VARCHAR(50) NOT NULL,
          item_code VARCHAR(100),
          item_name VARCHAR(255),
          delivery_date DATE,
          qty DECIMAL(10, 2) NOT NULL DEFAULT 1,
          rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
          amount DECIMAL(15, 2) GENERATED ALWAYS AS (qty * rate) STORED,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (sales_order_id) REFERENCES selling_sales_order(sales_order_id) ON DELETE CASCADE,
          INDEX idx_sales_order (sales_order_id),
          INDEX idx_item_code (item_code)
        )
      `)
      console.log('✓ sales_order_items table initialized')
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✓ sales_order_items table already exists')
      } else {
        console.warn('⚠ Could not initialize sales_order_items table:', err.message)
      }
    }

    // Add deleted_at column to supplier table if it doesn't exist
    try {
      await db.execute(`
        ALTER TABLE supplier ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
      `)
      console.log('✓ deleted_at column added to supplier table')
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ deleted_at column already exists in supplier table')
      } else {
        console.warn('⚠ Could not add deleted_at column to supplier table:', err.message)
      }
    }

    // Create item_barcode table if it doesn't exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS item_barcode (
          barcode_id VARCHAR(50) NOT NULL PRIMARY KEY,
          item_code VARCHAR(100) NOT NULL,
          barcode VARCHAR(100),
          barcode_name VARCHAR(255),
          barcode_type VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY barcode_unique (barcode),
          KEY idx_item_code (item_code),
          CONSTRAINT item_barcode_ibfk FOREIGN KEY (item_code) REFERENCES item(item_code) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `)
      console.log('✓ item_barcode table initialized')
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✓ item_barcode table already exists')
      } else {
        console.warn('⚠ Could not initialize item_barcode table:', err.message)
      }
    }

    // Create item_supplier table if it doesn't exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS item_supplier (
          item_supplier_id VARCHAR(50) NOT NULL PRIMARY KEY,
          item_code VARCHAR(100) NOT NULL,
          supplier_id VARCHAR(50),
          supplier_name VARCHAR(255),
          supplier_code VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_item_code (item_code),
          CONSTRAINT item_supplier_ibfk FOREIGN KEY (item_code) REFERENCES item(item_code) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `)
      console.log('✓ item_supplier table initialized')
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✓ item_supplier table already exists')
      } else {
        console.warn('⚠ Could not initialize item_supplier table:', err.message)
      }
    }

    // Create item_customer_detail table if it doesn't exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS item_customer_detail (
          customer_detail_id VARCHAR(50) NOT NULL PRIMARY KEY,
          item_code VARCHAR(100) NOT NULL,
          customer_name VARCHAR(255),
          customer_group VARCHAR(100),
          ref_code VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_item_code (item_code),
          CONSTRAINT item_customer_detail_ibfk FOREIGN KEY (item_code) REFERENCES item(item_code) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `)
      console.log('✓ item_customer_detail table initialized')
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✓ item_customer_detail table already exists')
      } else {
        console.warn('⚠ Could not initialize item_customer_detail table:', err.message)
      }
    }

    // Create item_dimension_parameter table if it doesn't exist
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS item_dimension_parameter (
          parameter_id VARCHAR(50) NOT NULL PRIMARY KEY,
          item_code VARCHAR(100) NOT NULL,
          parameter_type VARCHAR(100),
          name VARCHAR(255),
          parameter VARCHAR(255),
          value VARCHAR(255),
          status VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_item_code (item_code),
          CONSTRAINT item_dimension_parameter_ibfk FOREIGN KEY (item_code) REFERENCES item(item_code) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `)
      console.log('✓ item_dimension_parameter table initialized')
    } catch (err) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('✓ item_dimension_parameter table already exists')
      } else {
        console.warn('⚠ Could not initialize item_dimension_parameter table:', err.message)
      }
    }
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Setup routes function - called after DB initialization
async function setupRoutes() {
  // Initialize Setup Model tables
  try {
    const setupModel = new SetupModel(db)
    await setupModel.ensureTablesExist()
    console.log('✓ Setup tables initialized')
  } catch (error) {
    console.warn('⚠ Could not initialize setup tables:', error.message)
  }

  // API Routes - Authentication (requires db)
  app.use('/api/auth', authRoutes(db))
  
  // API Routes - Buying Module
  app.use('/api/suppliers', supplierRoutes)
  app.use('/api/items', itemRoutes)
  app.use('/api/material-requests', materialRequestRoutes)
  app.use('/api/rfqs', rfqRoutes)
  app.use('/api/quotations', quotationRoutes)
  app.use('/api/purchase-orders', purchaseOrderRoutes)
  app.use('/api/purchase-receipts', purchaseReceiptRoutes)
  app.use('/api/purchase-invoices', purchaseInvoiceRoutes)
  app.use('/api/tax-templates', taxTemplateRoutes)
  app.use('/api/analytics', analyticsRoutes)
  
  // API Routes - Stock Module
  app.use('/api/stock/warehouses', stockWarehouseRoutes)
  app.use('/api/stock/stock-balance', stockBalanceRoutes)
  app.use('/api/stock/ledger', stockLedgerRoutes)
  app.use('/api/stock/entries', stockEntryRoutes)
  app.use('/api/stock/transfers', materialTransferRoutes)
  app.use('/api/stock/batches', batchTrackingRoutes)
  app.use('/api/stock/reconciliation', stockReconciliationRoutes)
  app.use('/api/stock/reorder', reorderManagementRoutes)
  
  // API Routes - Production Module
  app.use('/api/production', createProductionRoutes(db))
  
  // API Routes - Tool Room Module
  app.use('/api/toolroom', createToolRoomRoutes(db))
  
  // API Routes - Quality Control Module
  app.use('/api/qc', createQCRoutes(db))
  
  // API Routes - Dispatch Module
  app.use('/api/dispatch', createDispatchRoutes(db))
  
  // API Routes - HR & Payroll Module
  app.use('/api/hr', createHRPayrollRoutes(db))
  
  // API Routes - Finance & Accounts Module
  app.use('/api/finance', createFinanceRoutes(db))
  
  // API Routes - Selling Module
  app.use('/api/selling', sellingRoutes)

  // API Routes - GRN Requests
  app.use('/api/grn-requests', grnRequestRoutes)

  // API Routes - Company Information
  app.use('/api/company-info', companyRoutes)

  // API Routes - Setup Master Data
  app.use('/api/setup', setupMasterDataRoutes)

  // API Routes - CRM
  app.use('/api/crm', crmRoutes)
  
  // Error handling middleware (must be after all routes)
  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  })

  // 404 handler (must be last)
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })
}

const PORT = process.env.PORT || 5000

// Start server
async function start() {
  await initializeDatabase()
  await setupRoutes() // Setup routes after DB is initialized
  
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`)
    console.log(`✓ API Base URL: http://localhost:${PORT}/api`)
    console.log('Environment:', process.env.NODE_ENV || 'development')
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

export { app, db }
