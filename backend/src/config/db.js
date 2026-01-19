const fs = require('fs');
const path = require('path');
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
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' }
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
    const [columns] = await connection.query('SHOW COLUMNS FROM quotation_items');
    const existing = new Set(columns.map(column => column.Field));
    const requiredColumns = [
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' }
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
      { name: 'store_acceptance_notes', definition: 'TEXT NULL' }
    ];
    
    const missingPoCols = requiredPoCols.filter(c => !existingPoCols.has(c.name));
    if (missingPoCols.length > 0) {
      const alterPoSql = `ALTER TABLE purchase_orders ${missingPoCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterPoSql);
      console.log('Purchase Order material request columns synchronized');
    }

    // Update purchase_order_items table
    const [itemCols] = await connection.query('SHOW COLUMNS FROM purchase_order_items');
    const existingItemCols = new Set(itemCols.map(c => c.Field));
    const requiredItemCols = [
      { name: 'accepted_quantity', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' }
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

const ensureStockColumns = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Update stock_ledger table
    const [ledgerCols] = await connection.query('SHOW COLUMNS FROM stock_ledger');
    const existingLedgerCols = new Set(ledgerCols.map(c => c.Field));
    const requiredStockCols = [
      { name: 'material_name', definition: 'VARCHAR(255) NULL' },
      { name: 'material_type', definition: 'VARCHAR(100) NULL' },
      { name: 'valuation_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'selling_rate', definition: 'DECIMAL(12, 2) DEFAULT 0' },
      { name: 'no_of_cavity', definition: 'INT DEFAULT 1' },
      { name: 'weight_per_unit', definition: 'DECIMAL(12, 3) DEFAULT 0' },
      { name: 'weight_uom', definition: 'VARCHAR(20) NULL' },
      { name: 'drawing_no', definition: 'VARCHAR(120) NULL' },
      { name: 'revision', definition: 'VARCHAR(50) NULL' },
      { name: 'material_grade', definition: 'VARCHAR(100) NULL' },
      { name: 'unit', definition: 'VARCHAR(20) DEFAULT "Nos"' }
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
      const alterBalanceSql = `ALTER TABLE stock_balance ${missingBalanceCols
        .map(c => `ADD COLUMN \`${c.name}\` ${c.definition}`)
        .join(', ')};`;
      await connection.query(alterBalanceSql);
      console.log('Stock Balance material columns synchronized');
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
      console.error('Stock columns sync failed', error.message);
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
        status ENUM('PENDING', 'APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED') DEFAULT 'PENDING',
        total_amount DECIMAL(14, 2) DEFAULT 0,
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
      { name: 'notes', definition: 'TEXT NULL' },
      { name: 'sales_order_item_id', definition: 'INT NULL' }
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
      if (!type.includes('APPROVAL')) {
        await connection.query(`
          ALTER TABLE quotation_requests 
          MODIFY COLUMN status ENUM('PENDING', 'APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED') DEFAULT 'PENDING'
        `);
        console.log('Quotation Request status updated with APPROVAL');
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
      { name: 'revision_no', definition: 'VARCHAR(50) NULL' },
      { name: 'drawing_pdf', definition: 'VARCHAR(500) NULL' },
      { name: 'updated_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
      { name: 'item_group', definition: 'VARCHAR(100)' },
      { name: 'is_active', definition: 'TINYINT(1) DEFAULT 1' },
      { name: 'is_default', definition: 'TINYINT(1) DEFAULT 0' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    if (!missing.length) return;

    const alterSql = `ALTER TABLE sales_order_items ${missing
      .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
      .join(', ')};`;

    await connection.query(alterSql);
    console.log('Sales order item columns synchronized');
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
      if (!type.includes('QUOTATION_SENT') || !type.includes('BOM_SUBMITTED') || !type.includes('BOM_APPROVED')) {
        await connection.query(`
          ALTER TABLE sales_orders 
          MODIFY COLUMN status ENUM(
            'CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'DESIGN_QUERY', 'QUOTATION_SENT',
            'BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 
            'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 
            'PRODUCTION_COMPLETED', 'CLOSED'
          ) DEFAULT 'CREATED'
        `);
        console.log('Sales order statuses updated with QUOTATION_SENT');
      }
    }
  } catch (error) {
    console.error('Sales order status sync failed', error.message);
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
        sales_order_item_id INT NOT NULL,
        material_name VARCHAR(255) NOT NULL,
        material_type VARCHAR(100),
        item_group VARCHAR(100),
        qty_per_pc DECIMAL(12, 4) NOT NULL,
        uom VARCHAR(20) DEFAULT 'KG',
        rate DECIMAL(12, 2) DEFAULT 0,
        warehouse VARCHAR(100),
        operation VARCHAR(100),
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
        sales_order_item_id INT NOT NULL,
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
        sales_order_item_id INT NOT NULL,
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
        sales_order_item_id INT NOT NULL,
        item_code VARCHAR(100),
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
      { name: 'operation', definition: 'VARCHAR(100)' }
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

const bootstrapDatabase = async () => {
  await ensureDatabase();
  await ensureSchema();
  await ensureCustomerPoColumns();
  await ensurePurchaseOrderItemColumns();
  await ensureQuotationItemColumns();
  await ensurePoReceiptItemTable();
  await ensureGrnColumns();
  await ensurePoMaterialRequestColumns();
  await ensureStockColumns();
  await ensureWarehouseAllocationTables();
  await ensureDesignOrderTables();
  await ensureQuotationRequestTables();
  await ensureQuotationRequestStatus();
  await ensureSalesOrderItemColumns();
  await ensureSalesOrderStatuses();
  await ensureCustomerDrawingTable();
  await ensureSalesOrderItemMaterialsTable();
  await ensureBOMAdditionalTables();
  await ensureBOMMaterialsColumns();
};

bootstrapDatabase();

module.exports = pool;
