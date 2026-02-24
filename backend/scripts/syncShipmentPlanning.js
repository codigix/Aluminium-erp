const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'aluminium_user',
  password: process.env.DB_PASSWORD || 'C0digix$309',
  database: process.env.DB_NAME || 'sales_erp'
};

async function syncShipmentPlanningColumns() {
  let connection;
  try {
    connection = await mysql.createConnection(baseConfig);
    console.log('Database connection successful');

    const [columns] = await connection.query('SHOW COLUMNS FROM shipment_orders');
    const existing = new Set(columns.map(column => column.Field));
    
    const requiredColumns = [
      { name: 'transporter', definition: 'VARCHAR(255) NULL' },
      { name: 'vehicle_number', definition: 'VARCHAR(100) NULL' },
      { name: 'driver_name', definition: 'VARCHAR(255) NULL' },
      { name: 'driver_contact', definition: 'VARCHAR(20) NULL' },
      { name: 'planned_dispatch_date', definition: 'DATE NULL' },
      { name: 'estimated_delivery_date', definition: 'DATE NULL' },
      { name: 'packing_status', definition: "ENUM('PENDING', 'PACKED') DEFAULT 'PENDING'" },
      { name: 'special_instructions', definition: 'TEXT NULL' }
    ];

    const missing = requiredColumns.filter(column => !existing.has(column.name));
    
    if (missing.length > 0) {
      const alterSql = `ALTER TABLE shipment_orders ${missing
        .map(column => `ADD COLUMN \`${column.name}\` ${column.definition}`)
        .join(', ')};`;

      await connection.query(alterSql);
      console.log('Shipment Planning columns synchronized successfully');
    } else {
      console.log('All Shipment Planning columns already exist');
    }

  } catch (error) {
    console.error('Column sync failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

syncShipmentPlanningColumns();
