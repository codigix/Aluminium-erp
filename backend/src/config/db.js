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

const bootstrapDatabase = async () => {
  await ensureDatabase();
  await ensureSchema();
  await ensureCustomerPoColumns();
};

bootstrapDatabase();

module.exports = pool;
