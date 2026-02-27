const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'backend'
};

const database = process.env.DB_NAME || 'sales_erp';
const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');

const pool = mysql.createPool({
  ...baseConfig,
  database,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true
});

const ensureJobCardColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM job_cards');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'std_time', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'hourly_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'operation_name', definition: 'VARCHAR(255) NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (missing.length > 0) {
      const alterSql = `ALTER TABLE job_cards ${missing
        .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
        .join(', ')};`;

      await connection.query(alterSql);
      console.log('Job Card columns synchronized');
    }

    // Create detailed logging tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_card_time_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_card_id INT NOT NULL,
        log_date DATE NOT NULL,
        operator_id INT,
        workstation_id INT,
        shift VARCHAR(20),
        start_time DATETIME,
        end_time DATETIME,
        produced_qty DECIMAL(12, 3) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_card_quality_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_card_id INT NOT NULL,
        check_date DATE NOT NULL,
        shift VARCHAR(20),
        inspected_qty DECIMAL(12, 3) DEFAULT 0,
        accepted_qty DECIMAL(12, 3) DEFAULT 0,
        rejected_qty DECIMAL(12, 3) DEFAULT 0,
        scrap_qty DECIMAL(12, 3) DEFAULT 0,
        rejection_reason TEXT,
        status ENUM('PENDING', 'Approved ', 'REJECTED') DEFAULT 'PENDING',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_card_downtime_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_card_id INT NOT NULL,
        downtime_date DATE NOT NULL,
        shift VARCHAR(20),
        downtime_type VARCHAR(100),
        start_time DATETIME,
        end_time DATETIME,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
      )
    `);
    console.log('Job Card detailed log tables synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Job Card column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureDatabase = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
  } catch (error) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      try {
        const adminConnection = await mysql.createConnection(baseConfig);
        await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
        await adminConnection.end();
        console.log(`Database ${database} created`);
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        connection.release();
      } catch (creationError) {
        console.error('Database creation failed', creationError.message);
      }
    } else {
      console.error('Database connection failed', error.message);
    }
  }
};

const ensureSchema = async () => {
  let connection;
  try {
    const schemaSql = await fs.promises.readFile(schemaPath, 'utf8');
    if (!schemaSql.trim()) {
      console.warn('Database schema file is empty');
      return;
    }
    connection = await pool.getConnection();
    await connection.query(schemaSql);
    console.log('Database schema synchronized');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Database schema sync failed', error.message);
    } else {
      console.warn('Database schema file not found');
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const ensureCustomerPoColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM customer_pos');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'credit_days', definition: 'INT NULL' },
      { name: 'freight_terms', definition: 'VARCHAR(255) NULL' },
      { name: 'packing_forwarding', definition: 'VARCHAR(255) NULL' },
      { name: 'insurance_terms', definition: 'VARCHAR(255) NULL' },
      { name: 'delivery_terms', definition: 'VARCHAR(255) NULL' },
      { name: 'terms_and_conditions', definition: 'TEXT NULL' },
      { name: 'special_notes', definition: 'TEXT NULL' },
      { name: 'inspection_clause', definition: 'VARCHAR(50) NULL' },
      { name: 'test_certificate', definition: 'VARCHAR(50) NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) {
      return;
    }

    const alterSql = `ALTER TABLE customer_pos ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('Customer PO columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Customer PO column sync failed', error.message);
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const ensurePurchaseOrderItemColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM purchase_order_items');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'cgst_percent', definition: 'DECIMAL(5, 2) DEFAULT 0' },
      { name: 'cgst_amount', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'sgst_percent', definition: 'DECIMAL(5, 2) DEFAULT 0' },
      { name: 'sgst_amount', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'total_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' },
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'drawing_id', definition: 'INT NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) {
      return;
    }

    const alterSql = `ALTER TABLE purchase_order_items ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('Purchase order item columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Purchase order item column sync failed', error.message);
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const ensureQuotationItemColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Update quotations table first
    const [qCols] = await connection.query('SHOW COLUMNS FROM quotations');
    const existingQCols = new Set(qCols.map(c => c.Field));
    const requiredQCols = [
      { name: 'tax_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' },
      { name: 'grand_total', definition: 'DECIMAL(14, 2) DEFAULT 0' }
    ];
    
    const missingQCols = requiredQCols.filter(c => !existingQCols.has(c.name));
    if (missingQCols.length > 0) {
      const alterQSql = `ALTER TABLE quotations ${missingQCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterQSql);
      console.log('Quotation tax columns synchronized');
    }

    const [columns] = await connection.query('SHOW COLUMNS FROM quotation_items');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'drawing_id', definition: 'INT NULL' },
      { name: 'design_qty', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'cgst_percent', definition: 'DECIMAL(5, 2) DEFAULT 0' },
      { name: 'cgst_amount', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'sgst_percent', definition: 'DECIMAL(5, 2) DEFAULT 0' },
      { name: 'sgst_amount', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'total_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) {
      return;
    }

    const alterSql = `ALTER TABLE quotation_items ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('Quotation item columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Quotation item column sync failed', error.message);
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const ensurePoReceiptItemTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS po_receipt_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_id INT NOT NULL,
        po_item_id INT NOT NULL,
        received_quantity DECIMAL(12, 3) DEFAULT 0,
        FOREIGN KEY (receipt_id) REFERENCES po_receipts(id) ON DELETE CASCADE
      )
    `);
    console.log('PO Receipt items table synchronized');
  } catch (error) {
    console.error('PO Receipt items table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureGrnColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM grns');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'po_receipt_id', definition: 'INT NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) return;

    const alterSql = `ALTER TABLE grns ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('GRN columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('GRN column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};
const ensurePoMaterialRequestColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Update purchase_orders table
    const [poCols] = await connection.query('SHOW COLUMNS FROM purchase_orders');
    const existingPoCols = new Set(poCols.map(c => c.Field));
    const requiredPoCols = [
      { name: 'store_acceptance_status', definition: "ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING'" },
      { name: 'store_acceptance_date', definition: 'TIMESTAMP NULL' },
      { name: 'store_acceptance_notes', definition: 'TEXT NULL' },
      { name: 'mr_id', definition: 'INT NULL' },
      { name: 'approved_by', definition: 'INT NULL' },
      { name: 'approved_at', definition: 'TIMESTAMP NULL' }
    ];
    
    const missingPoCols = requiredPoCols.filter(c => !existingPoCols.has(c.name));
    if (missingPoCols.length > 0) {
      const alterPoSql = `ALTER TABLE purchase_orders ${missingPoCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterPoSql);
      console.log('Purchase Order material request columns synchronized');
    }

    // Ensure quotation_id and vendor_id are nullable for MR-based POs
    const quotationIdCol = poCols.find(c => c.Field === 'quotation_id');
    if (quotationIdCol && quotationIdCol.Null === 'NO') {
      await connection.query('ALTER TABLE purchase_orders MODIFY COLUMN quotation_id INT NULL');
      console.log('Purchase Order quotation_id made nullable');
    }

    const vendorIdCol = poCols.find(c => c.Field === 'vendor_id');
    if (vendorIdCol && vendorIdCol.Null === 'NO') {
      await connection.query('ALTER TABLE purchase_orders MODIFY COLUMN vendor_id INT NULL');
      console.log('Purchase Order vendor_id made nullable');
    }

    // Update purchase_order_items table
    const [itemCols] = await connection.query('SHOW COLUMNS FROM purchase_order_items');
    const existingItemCols = new Set(itemCols.map(c => c.Field));
    const requiredItemCols = [
      { name: 'accepted_quantity', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'design_qty', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'drawing_id', definition: 'INT NULL' }
    ];

    const missingItemCols = requiredItemCols.filter(c => !existingItemCols.has(c.name));
    if (missingItemCols.length > 0) {
      const alterItemSql = `ALTER TABLE purchase_order_items ${missingItemCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterItemSql);
      console.log('Purchase Order Item material request columns synchronized');
    }
  } catch (error) {
    console.error('PO Material Request column sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureMaterialRequestColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM material_requests');
    const existing = new Set(columns.map(column => column.Field));
    
    const requiredColumns = [
      { name: 'linked_po_id', definition: 'INT NULL' },
      { name: 'linked_po_number', definition: 'VARCHAR(100) NULL' },
      { name: 'target_warehouse', definition: 'VARCHAR(100) NULL' },
      { name: 'source_warehouse', definition: 'VARCHAR(100) NULL' },
      { name: 'plan_id', definition: 'INT NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    
    // Update status enum if needed
    const statusCol = columns.find(c => c.Field === 'status');
    if (statusCol && (!statusCol.Type.includes('ORDERED') || !statusCol.Type.includes('COMPLETED') || !statusCol.Type.includes('PO_CREATED'))) {
      await connection.query(`ALTER TABLE material_requests MODIFY status ENUM('DRAFT', 'Approved ', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'ORDERED', 'COMPLETED', 'PO_CREATED') DEFAULT 'DRAFT'`);
      console.log('Material Request status enum updated');
    }

    if (missing.length > 0) {
      const alterSql = `ALTER TABLE material_requests ${missing
        .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
        .join(', ')};`;
      await connection.query(alterSql);
      console.log('Material Request columns synchronized');
    }
  } catch (error) {
    console.error('Material Request column sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensurePoReceiptColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM po_receipts');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'po_id', definition: 'INT NOT NULL' },
      { name: 'received_quantity', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'notes', definition: 'TEXT NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) return;

    const alterSql = `ALTER TABLE po_receipts ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('PO Receipt columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('PO Receipt column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureStockColumns = async () => {
  console.log('Stock columns sync started');
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Update stock_ledger table
    const [ledgerCols] = await connection.query('SHOW COLUMNS FROM stock_ledger');
    const existingLedgerCols = new Set(ledgerCols.map(c => c.Field));
    const requiredStockCols = [
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'product_type', definition: 'VARCHAR(100) NULL' },
      { name: 'valuation_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'selling_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'no_of_cavity', definition: 'INT DEFAULT 1' },
      { name: 'weight_per_unit', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'weight_uom', definition: 'VARCHAR(20) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'drawing_id', definition: 'INT NULL' },
      { name: 'revision', definition: 'VARCHAR(50) NULL' },
      { name: 'material_grade', definition: 'VARCHAR(100) NULL' },
      { name: 'unit', definition: 'VARCHAR(20) DEFAULT "Nos"' },
      { name: 'warehouse', definition: 'VARCHAR(100) NULL' },
      { name: 'qty_in', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'qty_out', definition: 'DECIMAL(12, 3) DEFAULT 0' }
    ];
    
    const missingLedgerCols = requiredStockCols.filter(c => !existingLedgerCols.has(c.name));
    if (missingLedgerCols.length > 0) {
      const alterLedgerSql = `ALTER TABLE stock_ledger ${missingLedgerCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterLedgerSql);
      console.log('Stock Ledger material columns synchronized');
    }

    // Update stock_balance table
    const [balanceCols] = await connection.query('SHOW COLUMNS FROM stock_balance');
    const existingBalanceCols = new Set(balanceCols.map(c => c.Field));
    
    const missingBalanceCols = requiredStockCols.filter(c => !existingBalanceCols.has(c.name));
    if (missingBalanceCols.length > 0) {
      console.log('Missing columns in stock_balance:', missingBalanceCols.map(c => c.name));
      const alterBalanceSql = `ALTER TABLE stock_balance ${missingBalanceCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      console.log('Executing SQL:', alterBalanceSql);
      await connection.query(alterBalanceSql);
      console.log('Stock Balance material columns synchronized');
    }

    // Add unique index for item_code + warehouse if it doesn't exist
    const [indexes] = await connection.query('SHOW INDEX FROM stock_balance');
    const hasItemWhIndex = indexes.some(idx => idx.Key_name === 'unique_item_warehouse');
    if (!hasItemWhIndex) {
      try {
        // First drop existing unique constraint on item_code if it exists and is not the PK
        const itemCodeIndex = indexes.find(idx => idx.Column_name === 'item_code' && idx.Non_unique === 0 && idx.Key_name !== 'PRIMARY');
        if (itemCodeIndex) {
          await connection.query(`ALTER TABLE stock_balance DROP INDEX ${itemCodeIndex.Key_name}`);
        }
        await connection.query('ALTER TABLE stock_balance ADD UNIQUE INDEX unique_item_warehouse (item_code, warehouse)');
        console.log('Added unique index for item_code and warehouse in stock_balance');
      } catch (e) {
        console.error('Failed to add unique index to stock_balance:', e.message);
      }
    }

    // Populate existing records if possible
    await connection.query(`
      UPDATE stock_ledger sl
      JOIN (
        SELECT item_code, ANY_VALUE(material_name) as material_name, ANY_VALUE(material_type) as material_type 
        FROM purchase_order_items 
        WHERE material_name IS NOT NULL
        GROUP BY item_code
      ) poi ON sl.item_code = poi.item_code
      SET sl.material_name = poi.material_name, sl.material_type = poi.material_type
      WHERE sl.material_name IS NULL
    `);

    await connection.query(`
      UPDATE stock_balance sb
      JOIN (
        SELECT item_code, ANY_VALUE(material_name) as material_name, ANY_VALUE(material_type) as material_type 
        FROM purchase_order_items 
        WHERE material_name IS NOT NULL
        GROUP BY item_code
      ) poi ON sb.item_code = poi.item_code
      SET sb.material_name = poi.material_name, sb.material_type = poi.material_type
      WHERE sb.material_name IS NULL
    `);

  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Stock columns sync failed:', error);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureWarehouseAllocationTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Update grn_items table
    const [grnItemCols] = await connection.query('SHOW COLUMNS FROM grn_items');
    const existingGrnItemCols = new Set(grnItemCols.map(c => c.Field));
    const requiredGrnItemCols = [
      { name: 'allocated_qty', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'allocation_status', definition: "ENUM('PENDING', 'PARTIAL', 'FULLY_ALLOCATED') DEFAULT 'PENDING'" }
    ];

    const missingGrnItemCols = requiredGrnItemCols.filter(c => !existingGrnItemCols.has(c.name));
    if (missingGrnItemCols.length > 0) {
      const alterGrnItemSql = `ALTER TABLE grn_items ${missingGrnItemCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterGrnItemSql);
      console.log('GRN Item allocation columns synchronized');
    }

    // Create warehouse_allocations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS warehouse_allocations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        grn_item_id INT NOT NULL,
        from_warehouse VARCHAR(50) DEFAULT 'RM-HOLD',
        to_warehouse VARCHAR(50) NOT NULL,
        quantity DECIMAL(12, 3) NOT NULL,
        allocated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grn_item_id) REFERENCES grn_items(id) ON DELETE CASCADE,
        FOREIGN KEY (allocated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('Warehouse allocation table synchronized');

  } catch (error) {
    console.error('Warehouse Allocation table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureWarehousesTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        warehouse_code VARCHAR(50) UNIQUE NOT NULL,
        warehouse_name VARCHAR(100) NOT NULL,
        warehouse_type VARCHAR(50),
        location VARCHAR(255),
        capacity DECIMAL(12, 3),
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Warehouses master table synchronized');
  } catch (error) {
    console.error('Warehouses master table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureCustomerDrawingTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_drawings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_name VARCHAR(255),
        drawing_no VARCHAR(120) NOT NULL,
        revision VARCHAR(50),
        qty INT DEFAULT 1,
        description TEXT,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(20),
        remarks TEXT,
        type VARCHAR(50) DEFAULT 'Customer',
        purpose VARCHAR(50) DEFAULT 'Reference Only',
        uploaded_by VARCHAR(120),
        status ENUM('PENDING', 'SHARED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add client_name column if it doesn't exist
    const [cols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'client_name'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN client_name VARCHAR(255) AFTER id");
      console.log('Added client_name column to customer_drawings');
    }

    const [qtyCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'qty'");
    if (qtyCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN qty INT DEFAULT 1 AFTER revision");
      console.log('Added qty column to customer_drawings');
    }

    const [contactPersonCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'contact_person'");
    if (contactPersonCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN contact_person VARCHAR(255) NULL");
      console.log('Added contact_person column to customer_drawings');
    }

    const [emailCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'email'");
    if (emailCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN email VARCHAR(255) NULL");
      console.log('Added email column to customer_drawings');
    }

    const [phoneCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'phone'");
    if (phoneCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN phone VARCHAR(20) NULL");
      console.log('Added phone column to customer_drawings');
    }

    const [customerTypeCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'customer_type'");
    if (customerTypeCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN customer_type VARCHAR(50) NULL");
      console.log('Added customer_type column to customer_drawings');
    }

    const [gstinCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'gstin'");
    if (gstinCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN gstin VARCHAR(50) NULL");
      console.log('Added gstin column to customer_drawings');
    }

    const [cityCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'city'");
    if (cityCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN city VARCHAR(100) NULL");
      console.log('Added city column to customer_drawings');
    }

    const [stateCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'state'");
    if (stateCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN state VARCHAR(100) NULL");
      console.log('Added state column to customer_drawings');
    }

    const [billingAddressCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'billing_address'");
    if (billingAddressCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN billing_address TEXT NULL");
      console.log('Added billing_address column to customer_drawings');
    }

    const [shippingAddressCols] = await connection.query("SHOW COLUMNS FROM customer_drawings LIKE 'shipping_address'");
    if (shippingAddressCols.length === 0) {
      await connection.query("ALTER TABLE customer_drawings ADD COLUMN shipping_address TEXT NULL");
      console.log('Added shipping_address column to customer_drawings');
    }

    console.log('Customer drawings table synchronized');
  } catch (error) {
    console.error('Customer drawing table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureDesignOrderTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS design_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        design_order_number VARCHAR(100) UNIQUE NOT NULL,
        sales_order_id INT NOT NULL,
        status ENUM('DRAFT', 'IN_DESIGN', 'COMPLETED') DEFAULT 'DRAFT',
        start_date TIMESTAMP NULL,
        completion_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
      )
    `);
    console.log('Design Order table synchronized');

  } catch (error) {
    console.error('Design Order table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureQuotationRequestTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS quotation_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sales_order_id INT NOT NULL,
        sales_order_item_id INT NULL,
        company_id INT NOT NULL,
        status ENUM('PENDING', 'APPROVAL', 'Approved ', 'REJECTED', 'COMPLETED', 'ACCEPTED') DEFAULT 'PENDING',
        total_amount DECIMAL(14, 2) DEFAULT 0,
        received_amount DECIMAL(14, 2) DEFAULT 0,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE
      )
    `);
    console.log('Quotation Request table synchronized');

    const [quotationCols] = await connection.query('SHOW COLUMNS FROM quotation_requests');
    const existing = new Set(quotationCols.map(c => c.Field));
    const requiredColumns = [
      { name: 'total_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' },
      { name: 'received_amount', definition: 'DECIMAL(14, 2) DEFAULT 0' },
      { name: 'notes', definition: 'TEXT NULL' },
      { name: 'sales_order_item_id', definition: 'INT NULL' },
      { name: 'rejection_reason', definition: 'TEXT NULL' }
    ];
    
    const missing = requiredColumns.filter(c => !existing.has(c.name));
    if (missing.length > 0) {
      const alterSql = `ALTER TABLE quotation_requests ${missing
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterSql);
      console.log('Quotation request columns synchronized');
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS design_rejections (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sales_order_id INT NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
      )
    `);
    console.log('Design Rejections table synchronized');

  } catch (error) {
    console.error('Quotation Request/Design Rejection tables sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureQuotationRequestStatus = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query("SHOW COLUMNS FROM quotation_requests LIKE 'status'");
    if (columns.length > 0) {
      const type = columns[0].Type;
      if (!type.includes('APPROVAL') || !type.includes('ACCEPTED')) {
        await connection.query(`
          ALTER TABLE quotation_requests 
          MODIFY COLUMN status ENUM('PENDING', 'APPROVAL', 'Approved ', 'REJECTED', 'COMPLETED', 'ACCEPTED') DEFAULT 'PENDING'
        `);
        console.log('Quotation Request status updated with APPROVAL and ACCEPTED');
      }
    }
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Quotation Request status sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureSalesOrderItemColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM sales_order_items');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'drawing_id', definition: 'INT NULL' },
      { name: 'revision_no', definition: 'VARCHAR(50) NULL' },
      { name: 'drawing_pdf', definition: 'VARCHAR(500) NULL' },
      { name: 'updated_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
      { name: 'item_group', definition: 'VARCHAR(100) NULL' },
      { name: 'is_active', definition: 'TINYINT(1) DEFAULT 1' },
      { name: 'is_default', definition: 'TINYINT(1) DEFAULT 0' },
      { name: 'status', definition: "VARCHAR(50) DEFAULT 'PENDING'" },
      { name: 'rejection_reason', definition: 'TEXT' },
      { name: 'bom_cost', definition: 'DECIMAL(14, 2) DEFAULT 0' },
      { name: 'item_type', definition: "VARCHAR(50) DEFAULT 'FG'" }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) return;

    const alterSql = `ALTER TABLE sales_order_items ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('Sales order item columns synchronized');

    // Update item_type based on item_code prefix for existing records
    await connection.query(`
      UPDATE sales_order_items 
      SET item_type = CASE 
        WHEN item_code LIKE 'FG-%' THEN 'FG'
        WHEN item_code LIKE 'SA-%' THEN 'SA'
        WHEN item_code LIKE 'SFG-%' THEN 'SFG'
        WHEN item_code LIKE 'RM-%' THEN 'RM'
        ELSE 'FG'
      END
      WHERE item_type = 'FG' OR item_type IS NULL
    `);
    console.log('Sales order item types updated based on prefixes');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Sales order item column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureSalesOrderStatuses = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query("SHOW COLUMNS FROM sales_orders LIKE 'status'");
    if (columns.length > 0) {
      const type = columns[0].Type;
      if (!type.includes('QUOTATION_SENT') || !type.includes('BOM_SUBMITTED') || !type.includes('BOM_APPROVED') || !type.includes('READY_FOR_SHIPMENT')) {
        await connection.query(`
          ALTER TABLE sales_orders 
          MODIFY COLUMN status ENUM(
            'CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_Approved ', 'DESIGN_QUERY', 'QUOTATION_Sent ',
            'BOM_SUBMITTED', 'BOM_Approved ', 'PROCUREMENT_IN_PROGRESS', 
            'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 
            'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'QC_REJECTED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED'
          ) DEFAULT 'CREATED'
        `);
        console.log('Sales order statuses updated');
      }
    }
  } catch (error) {
    console.error('Sales order status sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureShipmentOrdersTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shipment_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shipment_code VARCHAR(50) UNIQUE NOT NULL,
        sales_order_id INT NULL,
        customer_id INT,
        dispatch_target_date DATE,
        priority VARCHAR(50),
        status ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'PLANNING', 'PLANNED', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'CLOSED', 'RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED') DEFAULT 'PENDING_ACCEPTANCE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);
    
    // Ensure status column is updated for existing table
    const [cols] = await connection.query("SHOW COLUMNS FROM shipment_orders LIKE 'status'");
    if (cols.length > 0 && (!cols[0].Type.includes('RETURN_INITIATED') || !cols[0].Type.includes('REJECTED'))) {
      console.log('Updating shipment_orders status enum...');
      await connection.query(`ALTER TABLE shipment_orders MODIFY COLUMN status ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'PLANNING', 'PLANNED', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'CLOSED', 'RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED') DEFAULT 'PENDING_ACCEPTANCE'`);
    }

    // Ensure planning and tracking columns exist
    const [allCols] = await connection.query("SHOW COLUMNS FROM shipment_orders");
    const existingCols = new Set(allCols.map(c => c.Field));
    const columnsToAdd = [
      { name: 'planned_dispatch_date', definition: 'DATE NULL' },
      { name: 'actual_delivery_date', definition: 'DATETIME NULL' },
      { name: 'estimated_delivery_date', definition: 'DATETIME NULL' },
      { name: 'transporter', definition: 'VARCHAR(255) NULL' },
      { name: 'vehicle_number', definition: 'VARCHAR(50) NULL' },
      { name: 'driver_name', definition: 'VARCHAR(255) NULL' },
      { name: 'driver_contact', definition: 'VARCHAR(20) NULL' },
      { name: 'packing_status', definition: "ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'PENDING'" },
      { name: 'shipping_address', definition: 'TEXT NULL' },
      { name: 'billing_address', definition: 'TEXT NULL' },
      { name: 'customer_name', definition: 'VARCHAR(255) NULL' },
      { name: 'customer_phone', definition: 'VARCHAR(20) NULL' },
      { name: 'customer_email', definition: 'VARCHAR(255) NULL' }
    ];

    for (const col of columnsToAdd) {
      if (!existingCols.has(col.name)) {
        await connection.query(`ALTER TABLE shipment_orders ADD COLUMN \`${col.name}\` ${col.definition}`);
        console.log(`Added column ${col.name} to shipment_orders`);
      }
    }

    console.log('Shipment orders table synchronized');
  } catch (error) {
    console.error('Shipment orders table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureSalesOrderItemMaterialsTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales_order_item_materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sales_order_item_id INT NULL,
        item_code VARCHAR(100) NULL,
        material_name VARCHAR(255) NOT NULL,
        material_type VARCHAR(100),
        item_group VARCHAR(100),
        qty_per_pc DECIMAL(12, 4) NOT NULL,
        uom VARCHAR(20) DEFAULT 'KG',
        rate DECIMAL(12, 2) DEFAULT 0,
        warehouse VARCHAR(100),
        operation VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE
      )
    `);
    console.log('Sales order item materials table synchronized');
  } catch (error) {
    console.error('Sales order item materials table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureBOMAdditionalTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Components Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales_order_item_components (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sales_order_item_id INT NULL,
        item_code VARCHAR(100) NULL,
        component_code VARCHAR(100),
        description TEXT,
        quantity DECIMAL(12, 4) NOT NULL,
        uom VARCHAR(20),
        rate DECIMAL(12, 2) DEFAULT 0,
        loss_percent DECIMAL(5, 2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE
      )
    `);

    // Operations Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales_order_item_operations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sales_order_item_id INT NULL,
        item_code VARCHAR(100) NULL,
        operation_name VARCHAR(100) NOT NULL,
        workstation VARCHAR(100),
        cycle_time_min DECIMAL(10, 2) DEFAULT 0,
        setup_time_min DECIMAL(10, 2) DEFAULT 0,
        hourly_rate DECIMAL(12, 2) DEFAULT 0,
        operation_type ENUM('In-House', 'Outsource') DEFAULT 'In-House',
        target_warehouse VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE
      )
    `);

    // Scrap Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales_order_item_scrap (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sales_order_item_id INT NULL,
        item_code VARCHAR(100) NULL,
        scrap_item_code VARCHAR(100),
        item_name VARCHAR(255),
        input_qty DECIMAL(12, 4) DEFAULT 0,
        loss_percent DECIMAL(5, 2) DEFAULT 0,
        rate DECIMAL(12, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE CASCADE
      )
    `);

    console.log('BOM Additional tables (Components, Operations, Scrap) synchronized');
  } catch (error) {
    console.error('BOM Additional tables sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureBOMMasterColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const tables = ['sales_order_item_materials', 'sales_order_item_components', 'sales_order_item_operations', 'sales_order_item_scrap'];
    
    for (const table of tables) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
      let existing = new Set(columns.map(column => column.Field));
      
      // Special case for scrap table: rename existing item_code to scrap_item_code if it's the only one
      if (table === 'sales_order_item_scrap' && existing.has('item_code') && !existing.has('scrap_item_code')) {
        // Check if item_code is in the old position (likely at the end or after item_name)
        // or just rename it anyway to make space for the master item_code
        await connection.query(`ALTER TABLE ${table} CHANGE COLUMN item_code scrap_item_code VARCHAR(100) NULL`);
        console.log(`Renamed item_code to scrap_item_code in ${table}`);
        // Refresh columns list
        const [newCols] = await connection.query(`SHOW COLUMNS FROM ${table}`);
        existing = new Set(newCols.map(c => c.Field));
      }

      // 1. Make sales_order_item_id NULLABLE
      const itemIdCol = columns.find(c => c.Field === 'sales_order_item_id');
      if (itemIdCol && itemIdCol.Null === 'NO') {
        await connection.query(`ALTER TABLE ${table} MODIFY sales_order_item_id INT NULL`);
        console.log(`Made sales_order_item_id nullable in ${table}`);
      }
      
      // 2. Add item_code column (this will be the master item code)
      if (!existing.has('item_code')) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN item_code VARCHAR(100) NULL AFTER sales_order_item_id`);
        console.log(`Added master item_code column to ${table}`);
      }
    }
  } catch (error) {
    console.error('BOM Master columns sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureBOMDrawingColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const tables = ['sales_order_item_materials', 'sales_order_item_components', 'sales_order_item_operations', 'sales_order_item_scrap'];
    
    for (const table of tables) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
      const existing = new Set(columns.map(column => column.Field));
      
      if (!existing.has('drawing_no')) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN drawing_no VARCHAR(120) NULL AFTER item_code`);
        console.log(`Added drawing_no column to ${table}`);
      }
    }
  } catch (error) {
    console.error('BOM Drawing columns sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureBOMHierarchyColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const tables = ['sales_order_item_materials', 'sales_order_item_components', 'sales_order_item_scrap'];
    
    for (const table of tables) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
      const existing = new Set(columns.map(column => column.Field));
      
      if (!existing.has('parent_id')) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN parent_id INT NULL AFTER item_code`);
        console.log(`Added parent_id column to ${table}`);
      }

      if (table === 'sales_order_item_components' && !existing.has('source_fg')) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN source_fg VARCHAR(120) NULL AFTER drawing_no`);
        console.log(`Added source_fg column to ${table}`);
      }
    }
  } catch (error) {
    console.error('BOM Hierarchy columns sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureBOMMaterialsColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM sales_order_item_materials');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'item_group', definition: 'VARCHAR(100)' },
      { name: 'warehouse', definition: 'VARCHAR(100)' },
      { name: 'operation', definition: 'VARCHAR(100)' },
      { name: 'description', definition: 'TEXT' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) return;

    const alterSql = `ALTER TABLE sales_order_item_materials ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('BOM Materials columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('BOM Materials column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureOperationsTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS operations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        operation_code VARCHAR(50) UNIQUE NOT NULL,
        operation_name VARCHAR(100) NOT NULL,
        workstation_id INT,
        std_time DECIMAL(10, 2) DEFAULT 0.00,
        time_uom ENUM('Hr', 'Min', 'Sec') DEFAULT 'Hr',
        hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL
      )
    `);
    
    // Check for missing hourly_rate column if table already exists
    const [columns] = await connection.query('SHOW COLUMNS FROM operations');
    const hasHourlyRate = columns.some(col => col.Field === 'hourly_rate');
    if (!hasHourlyRate) {
      await connection.query('ALTER TABLE operations ADD COLUMN hourly_rate DECIMAL(10, 2) DEFAULT 0.00 AFTER time_uom');
      console.log('Added hourly_rate column to operations table');
    }

    console.log('Operations table synchronized');
  } catch (error) {
    console.error('Operations table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureProductionPlanTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Create production_plans table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS production_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_code VARCHAR(50) UNIQUE NOT NULL,
        plan_date DATE NOT NULL,
        start_date DATE,
        end_date DATE,
        status ENUM('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT',
        remarks TEXT,
        sales_order_id INT,
        bom_no VARCHAR(100),
        target_qty DECIMAL(12, 3),
        naming_series VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Ensure missing columns in production_plans
    const [ppCols] = await connection.query('SHOW COLUMNS FROM production_plans');
    const existingPpCols = new Set(ppCols.map(c => c.Field));
    if (!existingPpCols.has('sales_order_id')) await connection.query('ALTER TABLE production_plans ADD COLUMN sales_order_id INT AFTER remarks');
    if (!existingPpCols.has('bom_no')) await connection.query('ALTER TABLE production_plans ADD COLUMN bom_no VARCHAR(100) AFTER sales_order_id');
    if (!existingPpCols.has('target_qty')) await connection.query('ALTER TABLE production_plans ADD COLUMN target_qty DECIMAL(12, 3) AFTER bom_no');
    if (!existingPpCols.has('naming_series')) await connection.query('ALTER TABLE production_plans ADD COLUMN naming_series VARCHAR(50) AFTER target_qty');

    // Create production_plan_items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS production_plan_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        sales_order_id INT NULL,
        sales_order_item_id INT NULL,
        item_code VARCHAR(120),
        description TEXT,
        bom_no VARCHAR(100),
        design_qty DECIMAL(12, 3),
        uom VARCHAR(20),
        planned_qty DECIMAL(12, 3) NOT NULL,
        rate DECIMAL(12, 2) DEFAULT 0,
        warehouse VARCHAR(100),
        workstation_id INT,
        planned_start_date DATE,
        planned_end_date DATE,
        status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL
      )
    `);

    // Ensure missing columns and remove strict FKs for direct orders
    const [ppiCols] = await connection.query('SHOW COLUMNS FROM production_plan_items');
    const existingPpiCols = new Set(ppiCols.map(c => c.Field));
    
    // 1. Make columns nullable for direct orders support
    const soIdCol = ppiCols.find(c => c.Field === 'sales_order_id');
    if (soIdCol && soIdCol.Null === 'NO') {
      try {
        // Drop FK first if exists
        await connection.query('ALTER TABLE production_plan_items DROP FOREIGN KEY production_plan_items_ibfk_2');
      } catch (e) { /* ignore if doesn't exist */ }
      await connection.query('ALTER TABLE production_plan_items MODIFY COLUMN sales_order_id INT NULL');
    }

    const soItemIdCol = ppiCols.find(c => c.Field === 'sales_order_item_id');
    if (soItemIdCol && soItemIdCol.Null === 'NO') {
      try {
        // Drop FK first if exists
        await connection.query('ALTER TABLE production_plan_items DROP FOREIGN KEY production_plan_items_ibfk_3');
      } catch (e) { /* ignore if doesn't exist */ }
      await connection.query('ALTER TABLE production_plan_items MODIFY COLUMN sales_order_item_id INT NULL');
    }

    if (!existingPpiCols.has('item_code')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN item_code VARCHAR(120) AFTER sales_order_item_id');
    if (!existingPpiCols.has('description')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN description TEXT AFTER item_code');
    if (!existingPpiCols.has('bom_no')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN bom_no VARCHAR(100) AFTER item_code');
    if (!existingPpiCols.has('warehouse')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN warehouse VARCHAR(100) AFTER planned_qty');
    if (!existingPpiCols.has('design_qty')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN design_qty DECIMAL(12, 3) AFTER bom_no');
    if (!existingPpiCols.has('uom')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN uom VARCHAR(20) AFTER design_qty');
    if (!existingPpiCols.has('rate')) await connection.query('ALTER TABLE production_plan_items ADD COLUMN rate DECIMAL(12, 2) DEFAULT 0 AFTER planned_qty');

    // Create production_plan_sub_assemblies table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS production_plan_sub_assemblies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        item_code VARCHAR(120) NOT NULL,
        description TEXT,
        required_qty DECIMAL(12, 3) NOT NULL,
        rate DECIMAL(12, 2) DEFAULT 0,
        bom_no VARCHAR(100),
        target_warehouse VARCHAR(100),
        scheduled_date DATE,
        manufacturing_type VARCHAR(50) DEFAULT 'In House',
        source_fg VARCHAR(120),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE
      )
    `);

    // Ensure missing columns in production_plan_sub_assemblies
    const [saCols] = await connection.query('SHOW COLUMNS FROM production_plan_sub_assemblies');
    const existingSaCols = new Set(saCols.map(c => c.Field));
    if (!existingSaCols.has('description')) await connection.query('ALTER TABLE production_plan_sub_assemblies ADD COLUMN description TEXT AFTER item_code');
    if (!existingSaCols.has('design_qty')) await connection.query('ALTER TABLE production_plan_sub_assemblies ADD COLUMN design_qty DECIMAL(12, 3) AFTER description');
    if (!existingSaCols.has('source_fg')) await connection.query('ALTER TABLE production_plan_sub_assemblies ADD COLUMN source_fg VARCHAR(120) AFTER manufacturing_type');
    if (!existingSaCols.has('rate')) await connection.query('ALTER TABLE production_plan_sub_assemblies ADD COLUMN rate DECIMAL(12, 2) DEFAULT 0 AFTER required_qty');

    // Create production_plan_materials table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS production_plan_materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        item_code VARCHAR(120),
        material_name VARCHAR(255) NOT NULL,
        required_qty DECIMAL(12, 3) NOT NULL,
        rate DECIMAL(12, 2) DEFAULT 0,
        uom VARCHAR(20),
        warehouse VARCHAR(100),
        bom_ref VARCHAR(100),
        source_assembly VARCHAR(120),
        material_category ENUM('CORE', 'EXPLODED') NOT NULL,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE
      )
    `);

    // Ensure rate column exists for existing table
    const [ppmCols] = await connection.query('SHOW COLUMNS FROM production_plan_materials');
    const existingPpmCols = new Set(ppmCols.map(c => c.Field));
    if (!existingPpmCols.has('design_qty')) {
      await connection.query('ALTER TABLE production_plan_materials ADD COLUMN design_qty DECIMAL(12, 3) AFTER material_name');
    }
    if (!existingPpmCols.has('rate')) {
      await connection.query('ALTER TABLE production_plan_materials ADD COLUMN rate DECIMAL(12, 2) DEFAULT 0 AFTER required_qty');
    }

    // Create production_plan_operations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS production_plan_operations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        step_no VARCHAR(10),
        operation_name VARCHAR(100) NOT NULL,
        workstation VARCHAR(100),
        base_time DECIMAL(12, 2) DEFAULT 0,
        source_item VARCHAR(120),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE
      )
    `);

    console.log('Production Plan tables synchronized');
  } catch (error) {
    console.error('Production Plan tables sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureWorkOrderTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wo_number VARCHAR(50) UNIQUE NOT NULL,
        production_plan_item_id INT,
        parent_wo_id INT,
        plan_id INT,
        sales_order_id INT,
        sales_order_item_id INT,
        item_code VARCHAR(120),
        item_name VARCHAR(255),
        bom_no VARCHAR(100),
        source_type ENUM('FG', 'SA') DEFAULT 'FG',
        workstation_id INT,
        quantity DECIMAL(12, 3) NOT NULL,
        start_date DATE,
        end_date DATE,
        priority ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') DEFAULT 'NORMAL',
        status ENUM('DRAFT', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (production_plan_item_id) REFERENCES production_plan_items(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_wo_id) REFERENCES work_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE SET NULL,
        FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL
      )
    `);

    // Ensure missing columns and remove strict FKs for direct orders in work_orders
    const [woCols] = await connection.query('SHOW COLUMNS FROM work_orders');
    const existingWoCols = new Set(woCols.map(c => c.Field));

    try {
      // Try to drop FKs that might reference sales_orders/items to support direct orders
      await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_1');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_2');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_3');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_4');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE work_orders DROP FOREIGN KEY work_orders_ibfk_5');
    } catch (e) {}

    if (!existingWoCols.has('plan_id')) await connection.query('ALTER TABLE work_orders ADD COLUMN plan_id INT AFTER production_plan_item_id');
    if (!existingWoCols.has('parent_wo_id')) await connection.query('ALTER TABLE work_orders ADD COLUMN parent_wo_id INT AFTER production_plan_item_id');
    if (!existingWoCols.has('item_code')) await connection.query('ALTER TABLE work_orders ADD COLUMN item_code VARCHAR(120) AFTER sales_order_item_id');
    if (!existingWoCols.has('item_name')) await connection.query('ALTER TABLE work_orders ADD COLUMN item_name VARCHAR(255) AFTER item_code');
    if (!existingWoCols.has('bom_no')) await connection.query('ALTER TABLE work_orders ADD COLUMN bom_no VARCHAR(100) AFTER item_name');
    if (!existingWoCols.has('source_type')) await connection.query('ALTER TABLE work_orders ADD COLUMN source_type ENUM("FG", "SA") DEFAULT "FG" AFTER bom_no');
    
    // Update status enum and make sales order columns nullable
    await connection.query("ALTER TABLE work_orders MODIFY COLUMN sales_order_id INT NULL");
    await connection.query("ALTER TABLE work_orders MODIFY COLUMN sales_order_item_id INT NULL");
    await connection.query("ALTER TABLE work_orders MODIFY COLUMN status ENUM('DRAFT', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT'");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_card_no VARCHAR(50) UNIQUE,
        work_order_id INT NOT NULL,
        operation_id INT,
        workstation_id INT,
        assigned_to INT,
        planned_qty DECIMAL(12, 3),
        produced_qty DECIMAL(12, 3) DEFAULT 0,
        accepted_qty DECIMAL(12, 3) DEFAULT 0,
        rejected_qty DECIMAL(12, 3) DEFAULT 0,
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        status ENUM('DRAFT', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED') DEFAULT 'DRAFT',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE SET NULL,
        FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Ensure missing columns and status enum in job_cards
    const [jcCols] = await connection.query('SHOW COLUMNS FROM job_cards');
    const existingJcCols = new Set(jcCols.map(c => c.Field));
    if (!existingJcCols.has('job_card_no')) await connection.query('ALTER TABLE job_cards ADD COLUMN job_card_no VARCHAR(50) UNIQUE AFTER id');
    if (!existingJcCols.has('accepted_qty')) await connection.query('ALTER TABLE job_cards ADD COLUMN accepted_qty DECIMAL(12, 3) DEFAULT 0 AFTER produced_qty');
    
    // Update status enum if necessary
    await connection.query("ALTER TABLE job_cards MODIFY COLUMN status ENUM('DRAFT', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED') DEFAULT 'DRAFT'");

    console.log('Work Order and Job Card tables synchronized');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS material_issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_number VARCHAR(50) UNIQUE NOT NULL,
        work_order_id INT NOT NULL,
        issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        issued_by INT,
        remarks TEXT,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS material_issue_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        material_name VARCHAR(255) NOT NULL,
        material_type VARCHAR(100),
        item_code VARCHAR(100),
        quantity DECIMAL(12, 3) NOT NULL,
        uom VARCHAR(20),
        warehouse VARCHAR(100),
        FOREIGN KEY (issue_id) REFERENCES material_issues(id) ON DELETE CASCADE
      )
    `);

    console.log('Material Issue tables synchronized');
  } catch (error) {
    console.error('Work Order, Job Card, and Material Issue tables sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureMaterialRequestTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS material_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mr_number VARCHAR(50) UNIQUE NOT NULL,
        department VARCHAR(100),
        requested_by INT,
        required_by DATE,
        purpose ENUM('Purchase Request', 'Internal Transfer', 'Material Issue') NOT NULL,
        status ENUM('DRAFT', 'Approved ', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'ORDERED', 'COMPLETED', 'PO_CREATED') DEFAULT 'DRAFT',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS material_request_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mr_id INT NOT NULL,
        item_code VARCHAR(100) NOT NULL,
        item_name VARCHAR(255),
        item_type VARCHAR(50),
        quantity DECIMAL(12, 3) NOT NULL,
        unit_rate DECIMAL(12, 2) DEFAULT 0,
        uom VARCHAR(20),
        warehouse VARCHAR(100),
        allocated_quantity DECIMAL(12, 3) DEFAULT 0,
        FOREIGN KEY (mr_id) REFERENCES material_requests(id) ON DELETE CASCADE
      )
    `);

    // Ensure columns exist for existing tables
    const [itemCols] = await connection.query('SHOW COLUMNS FROM material_request_items');
    const existingItemCols = new Set(itemCols.map(c => c.Field));
    if (!existingItemCols.has('warehouse')) {
      await connection.query('ALTER TABLE material_request_items ADD COLUMN warehouse VARCHAR(100)');
    }
    if (!existingItemCols.has('item_name')) {
      await connection.query('ALTER TABLE material_request_items ADD COLUMN item_name VARCHAR(255) AFTER item_code');
    }
    if (!existingItemCols.has('item_type')) {
      await connection.query('ALTER TABLE material_request_items ADD COLUMN item_type VARCHAR(50) AFTER item_name');
    }
    if (!existingItemCols.has('unit_rate')) {
      await connection.query('ALTER TABLE material_request_items ADD COLUMN unit_rate DECIMAL(12, 2) DEFAULT 0 AFTER quantity');
    }

    console.log('Material Request tables synchronized');
  } catch (error) {
    console.error('Material Request tables sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureSeed = async () => {
  let connection;
  try {
    const seedPath = path.resolve(__dirname, '../../../database/seed-data.sql');
    const seedSql = await fs.promises.readFile(seedPath, 'utf8');
    if (!seedSql.trim()) return;
    connection = await pool.getConnection();
    await connection.query(seedSql);
    console.log('Database seed data synchronized');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Database seed sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureQuotationCommunicationTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quotation_communications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        quotation_id INT NOT NULL,
        quotation_type ENUM('CLIENT', 'VENDOR') NOT NULL,
        sender_type ENUM('SYSTEM', 'CLIENT', 'VENDOR', 'INTERNAL') NOT NULL,
        sender_email VARCHAR(255),
        message TEXT NOT NULL,
        email_message_id VARCHAR(255),
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quotation (quotation_id, quotation_type)
      )
    `);

    // Add received_pdf_path to quotations if not exists
    const [cols] = await connection.query('SHOW COLUMNS FROM quotations');
    const existing = new Set(cols.map(c => c.Field));
    if (!existing.has('received_pdf_path')) {
      await connection.query('ALTER TABLE quotations ADD COLUMN received_pdf_path VARCHAR(500) NULL');
    }

    console.log('Quotation communication table and related columns synchronized');
  } catch (error) {
    console.error('Quotation communication table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureOrdersTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_no VARCHAR(50) UNIQUE,
        client_id INT,
        quotation_id INT,
        order_date DATE,
        delivery_date DATE,
        status VARCHAR(30) DEFAULT 'Created',
        source_type VARCHAR(50) DEFAULT 'DIRECT',
        warehouse VARCHAR(100),
        cgst_rate DECIMAL(5,2) DEFAULT 0,
        sgst_rate DECIMAL(5,2) DEFAULT 0,
        profit_margin DECIMAL(5,2) DEFAULT 0,
        subtotal DECIMAL(12,2) DEFAULT 0,
        gst DECIMAL(12,2) DEFAULT 0,
        grand_total DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client (client_id),
        INDEX idx_quotation (quotation_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        item_code VARCHAR(100),
        drawing_no VARCHAR(120),
        description TEXT,
        type VARCHAR(100),
        quantity DECIMAL(12,3) DEFAULT 0,
        rate DECIMAL(12,2) DEFAULT 0,
        amount DECIMAL(12,2) DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Ensure columns exist for existing tables
    const [columns] = await connection.query('SHOW COLUMNS FROM orders');
    const existing = new Set(columns.map(c => c.Field));
    
    if (!existing.has('source_type')) await connection.query('ALTER TABLE orders ADD COLUMN source_type VARCHAR(50) DEFAULT "DIRECT"');
    if (!existing.has('warehouse')) await connection.query('ALTER TABLE orders ADD COLUMN warehouse VARCHAR(100)');
    if (!existing.has('cgst_rate')) await connection.query('ALTER TABLE orders ADD COLUMN cgst_rate DECIMAL(5,2) DEFAULT 0');
    if (!existing.has('sgst_rate')) await connection.query('ALTER TABLE orders ADD COLUMN sgst_rate DECIMAL(5,2) DEFAULT 0');
    if (!existing.has('profit_margin')) await connection.query('ALTER TABLE orders ADD COLUMN profit_margin DECIMAL(5,2) DEFAULT 0');

    console.log('Orders and Order Items tables synchronized');
  } catch (error) {
    console.error('Orders table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureDeliveryChallansTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Create delivery_challans table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_challans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challan_number VARCHAR(50) UNIQUE NOT NULL,
        shipment_id INT NOT NULL,
        customer_id INT NOT NULL,
        delivery_status ENUM('DRAFT', 'COMPLETED') DEFAULT 'DRAFT',
        dispatch_time TIMESTAMP NULL,
        delivery_time TIMESTAMP NULL,
        receiver_name VARCHAR(120),
        receiver_mobile VARCHAR(30),
        signature_file VARCHAR(500),
        photo_proof VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (shipment_id) REFERENCES shipment_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES companies(id) ON DELETE CASCADE
      )
    `);

    // 2. Create delivery_challan_items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_challan_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challan_id INT NOT NULL,
        item_code VARCHAR(120),
        description TEXT,
        quantity DECIMAL(12, 3) NOT NULL,
        unit VARCHAR(20),
        weight DECIMAL(12, 3),
        FOREIGN KEY (challan_id) REFERENCES delivery_challans(id) ON DELETE CASCADE
      )
    `);

    console.log('Delivery Challan tables synchronized');
  } catch (error) {
    console.error('Delivery Challan table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureSalesOrderColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [columns] = await connection.query('SHOW COLUMNS FROM sales_orders');
    const existingColumns = new Set(columns.map(c => c.Field));
    const customerPoIdCol = columns.find(c => c.Field === 'customer_po_id');
    
    if (customerPoIdCol && customerPoIdCol.Null === 'NO') {
      console.log('[ensureSalesOrderColumns] Making customer_po_id nullable...');
      try {
        await connection.query('ALTER TABLE sales_orders MODIFY customer_po_id INT NULL');
      } catch (e) { console.error(e.message); }
    }

    if (!existingColumns.has('quotation_id')) {
      console.log('[ensureSalesOrderColumns] Adding quotation_id column...');
      await connection.query('ALTER TABLE sales_orders ADD COLUMN quotation_id INT NULL');
    }

    if (!existingColumns.has('source_type')) {
      console.log('[ensureSalesOrderColumns] Adding source_type column...');
      await connection.query('ALTER TABLE sales_orders ADD COLUMN source_type VARCHAR(50) DEFAULT "DIRECT"');
    }

    if (!existingColumns.has('is_sales_order')) {
      console.log('[ensureSalesOrderColumns] Adding is_sales_order column...');
      await connection.query('ALTER TABLE sales_orders ADD COLUMN is_sales_order TINYINT(1) DEFAULT 0');
      // Set existing ones to 1 as they were created as sales orders before this split
      await connection.query('UPDATE sales_orders SET is_sales_order = 1');
    }
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Sales order column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureVendorColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM vendors');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'gstin', definition: 'VARCHAR(20) NULL' },
      { name: 'group_name', definition: 'VARCHAR(100) NULL' },
      { name: 'lead_time', definition: 'VARCHAR(50) NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) return;

    const alterSql = `ALTER TABLE vendors ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('Vendor columns synchronized');
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Vendor column sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensurePurchaseOrderQuotationNullable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query("SHOW COLUMNS FROM purchase_orders LIKE 'quotation_id'");
    if (columns.length > 0 && columns[0].Null === 'NO') {
      console.log('[ensurePurchaseOrderQuotationNullable] Making quotation_id nullable in purchase_orders...');
      await connection.query('ALTER TABLE purchase_orders MODIFY quotation_id INT NULL');
    }
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Purchase Order quotation_id nullability sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensurePurchaseOrderVendorNullable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [columns] = await connection.query("SHOW COLUMNS FROM purchase_orders");
    const vendorIdCol = columns.find(c => c.Field === 'vendor_id');
    if (vendorIdCol && vendorIdCol.Null === 'NO') {
      console.log('[ensurePurchaseOrderVendorNullable] Making vendor_id nullable in purchase_orders...');
      await connection.query('ALTER TABLE purchase_orders MODIFY vendor_id INT NULL');
    }

    const statusCol = columns.find(c => c.Field === 'status');
    if (statusCol && !statusCol.Type.includes('PO_REQUEST')) {
      console.log('[ensurePurchaseOrderVendorNullable] Adding PO_REQUEST to purchase_orders status enum...');
      await connection.query(`ALTER TABLE purchase_orders MODIFY status ENUM('DRAFT', 'PO_REQUEST', 'ORDERED', 'Sent ', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED', 'COMPLETED') DEFAULT 'ORDERED'`);
    }
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Purchase Order vendor_id nullability or status sync failed', error.message);
    }
  } finally {
    if (connection) connection.release();
  }
};

const ensureStockEntryTables = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entry_no VARCHAR(50) UNIQUE NOT NULL,
        entry_type ENUM('Material Receipt', 'Material Issue', 'Material Transfer', 'Material Adjustment') NOT NULL,
        purpose VARCHAR(255),
        from_warehouse_id INT,
        to_warehouse_id INT,
        status ENUM('draft', 'submitted', 'cancelled') DEFAULT 'draft',
        entry_date DATE NOT NULL,
        grn_id INT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT,
        FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
        FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
        FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stock_entry_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stock_entry_id INT NOT NULL,
        item_code VARCHAR(100) NOT NULL,
        material_name VARCHAR(255),
        material_type VARCHAR(100),
        quantity DECIMAL(12, 3) NOT NULL,
        uom VARCHAR(20),
        batch_no VARCHAR(100),
        valuation_rate DECIMAL(12, 2) DEFAULT 0,
        amount DECIMAL(14, 2) DEFAULT 0,
        FOREIGN KEY (stock_entry_id) REFERENCES stock_entries(id) ON DELETE CASCADE
      )
    `);

    // Ensure material_name and material_type columns exist
    const [seItemsCols] = await connection.query("SHOW COLUMNS FROM stock_entry_items");
    const existingSeItemsCols = new Set(seItemsCols.map(c => c.Field));
    
    if (!existingSeItemsCols.has('material_name')) {
      await connection.query("ALTER TABLE stock_entry_items ADD COLUMN material_name VARCHAR(255) AFTER item_code");
    }
    if (!existingSeItemsCols.has('material_type')) {
      await connection.query("ALTER TABLE stock_entry_items ADD COLUMN material_type VARCHAR(100) AFTER material_name");
    }
    console.log('Stock Entry tables synchronized');
  } catch (error) {
    console.error('Stock Entry table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureGrnItemsTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grn_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grn_id INT NOT NULL,
        po_item_id INT NOT NULL,
        po_qty DECIMAL(12, 3) DEFAULT 0,
        received_qty DECIMAL(12, 3) DEFAULT 0,
        accepted_qty DECIMAL(12, 3) DEFAULT 0,
        rejected_qty DECIMAL(12, 3) DEFAULT 0,
        shortage_qty DECIMAL(12, 3) DEFAULT 0,
        overage_qty DECIMAL(12, 3) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'RECEIVED',
        remarks TEXT,
        is_approved TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE
      )
    `);
    
    // Ensure all columns exist
    const [columns] = await connection.query('SHOW COLUMNS FROM grn_items');
    const existing = new Set(columns.map(c => c.Field));
    const required = [
      { name: 'shortage_qty', def: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'overage_qty', def: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'rejected_qty', def: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'is_approved', def: 'TINYINT(1) DEFAULT 0' }
    ];
    
    for (const col of required) {
      if (!existing.has(col.name)) {
        await connection.query(`ALTER TABLE grn_items ADD COLUMN ${col.name} ${col.def}`);
      }
    }
    
    console.log('GRN items table synchronized');
  } catch (error) {
    console.error('GRN items table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureGrnExcessApprovalsTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grn_excess_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grn_item_id INT NOT NULL,
        excess_qty DECIMAL(12, 3) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        approval_notes TEXT,
        rejection_reason TEXT,
        approved_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (grn_item_id) REFERENCES grn_items(id) ON DELETE CASCADE
      )
    `);
    console.log('GRN excess approvals table synchronized');
  } catch (error) {
    console.error('GRN excess approvals table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureQCInspectionsTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Create qc_inspections table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS qc_inspections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grn_id INT NOT NULL,
        inspection_date DATE,
        pass_quantity DECIMAL(12, 3) DEFAULT 0,
        fail_quantity DECIMAL(12, 3) DEFAULT 0,
        status ENUM('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'ACCEPTED', 'REJECTED', 'SHORTAGE') DEFAULT 'PENDING',
        defects TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (grn_id) REFERENCES grns(id) ON DELETE CASCADE
      )
    `);

    // Ensure invoice_url column exists in qc_inspections
    const [qcCols] = await connection.query("SHOW COLUMNS FROM qc_inspections LIKE 'invoice_url'");
    if (qcCols.length === 0) {
      await connection.query("ALTER TABLE qc_inspections ADD COLUMN invoice_url VARCHAR(255) NULL AFTER remarks");
      console.log('QC Inspections invoice_url column added');
    }

    // Create qc_inspection_items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS qc_inspection_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        qc_inspection_id INT NOT NULL,
        grn_item_id INT NOT NULL,
        warehouse_id INT NULL,
        item_code VARCHAR(100),
        po_qty DECIMAL(12, 3) DEFAULT 0,
        received_qty DECIMAL(12, 3) DEFAULT 0,
        accepted_qty DECIMAL(12, 3) DEFAULT 0,
        rejected_qty DECIMAL(12, 3) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'PENDING',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (qc_inspection_id) REFERENCES qc_inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (grn_item_id) REFERENCES grn_items(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
      )
    `);

    // Ensure warehouse_id column exists
    const [cols] = await connection.query("SHOW COLUMNS FROM qc_inspection_items LIKE 'warehouse_id'");
    if (cols.length === 0) {
      await connection.query("ALTER TABLE qc_inspection_items ADD COLUMN warehouse_id INT NULL AFTER grn_item_id");
      await connection.query("ALTER TABLE qc_inspection_items ADD FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL");
    }

    // Ensure remarks column exists in qc_inspection_items
    const [itemRemarksCol] = await connection.query("SHOW COLUMNS FROM qc_inspection_items LIKE 'remarks'");
    if (itemRemarksCol.length === 0) {
      await connection.query("ALTER TABLE qc_inspection_items ADD COLUMN remarks TEXT AFTER status");
      console.log('QC Inspection items remarks column added');
    }
    
    console.log('QC Inspections tables synchronized');
  } catch (error) {
    console.error('QC Inspections table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const ensureReturnsTable = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shipment_returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_code VARCHAR(50) NOT NULL UNIQUE,
        shipment_id INT NOT NULL,
        order_id INT NULL,
        customer_id INT NULL,
        reason TEXT NOT NULL,
        status ENUM('RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED') DEFAULT 'RETURN_INITIATED',
        pickup_date DATE NULL,
        received_date DATE NULL,
        condition_status ENUM('GOOD', 'DAMAGED', 'WRONG_ITEM', 'CANCELLED') NULL,
        refund_amount DECIMAL(15, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (shipment_id) REFERENCES shipment_orders(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS shipment_return_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_id INT NOT NULL,
        item_code VARCHAR(100) NOT NULL,
        quantity DECIMAL(15, 3) NOT NULL,
        condition_note TEXT,
        FOREIGN KEY (return_id) REFERENCES shipment_returns(id) ON DELETE CASCADE
      )
    `);
    console.log('Shipment Returns tables synchronized');
  } catch (error) {
    console.error('Shipment Returns table sync failed', error.message);
  } finally {
    if (connection) connection.release();
  }
};

const bootstrapDatabase = async () => {
  await ensureDatabase();
  await ensureSchema();
  await ensureSeed();
  await ensureVendorColumns();
  await ensureCustomerPoColumns();
  await ensurePurchaseOrderItemColumns();
  await ensurePurchaseOrderQuotationNullable();
  await ensurePurchaseOrderVendorNullable();
  await ensureQuotationItemColumns();
  await ensurePoReceiptItemTable();
  await ensurePoReceiptColumns();
  await ensureGrnColumns();
  await ensureGrnItemsTable();
  await ensureGrnExcessApprovalsTable();
  await ensureQCInspectionsTable();
  await ensurePoMaterialRequestColumns();
  await ensureStockColumns();
  await ensureStockEntryTables();
  await ensureWarehouseAllocationTables();
  await ensureWarehousesTable();
  await ensureDesignOrderTables();
  await ensureQuotationRequestTables();
  await ensureQuotationRequestStatus();
  await ensureSalesOrderColumns();
  await ensureSalesOrderItemColumns();
  await ensureSalesOrderStatuses();
  await ensureCustomerDrawingTable();
  await ensureShipmentOrdersTable();
  await ensureSalesOrderItemMaterialsTable();
  await ensureBOMAdditionalTables();
  await ensureBOMMaterialsColumns();
  await ensureBOMMasterColumns();
  await ensureBOMDrawingColumns();
  await ensureBOMHierarchyColumns();
  await ensureOperationsTable();
  await ensureProductionPlanTables();
  await ensureWorkOrderTables();
  await ensureJobCardColumns();
  await ensureMaterialRequestTables();
  await ensureMaterialRequestColumns();
  await ensureQuotationCommunicationTable();
  await ensureOrdersTable();
  await ensureDeliveryChallansTable();
  await ensureReturnsTable();
};

bootstrapDatabase();

module.exports = pool;
