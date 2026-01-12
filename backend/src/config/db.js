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
      { name: 'material_type', definition: 'VARCHAR(100) NULL' }
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
      { name: 'material_type', definition: 'VARCHAR(100) NULL' }
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
      { name: 'material_type', definition: 'VARCHAR(100) NULL' }
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

const bootstrapDatabase = async () => {
  await ensureDatabase();
  await ensureSchema();
  await ensureCustomerPoColumns();
  await ensurePurchaseOrderItemColumns();
  await ensureQuotationItemColumns();
  await ensurePoReceiptItemTable();
  await ensureGrnColumns();
  await ensurePoMaterialRequestColumns();
};

bootstrapDatabase();

module.exports = pool;
