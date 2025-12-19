
import { createPool } from 'mysql2/promise';
import { ClientPOModel } from '../src/models/ClientPOModel.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCreatePO() {
  const db = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'aluminium_erp',
  });

  const model = new ClientPOModel(db);

  // 1. Get a valid client ID
  const [clients] = await db.execute('SELECT customer_id FROM selling_customer LIMIT 1');
  if (clients.length === 0) {
    console.error('No clients found. Cannot test.');
    await db.end();
    return;
  }
  const clientId = clients[0].customer_id;
  console.log('Using Client ID:', clientId);

  const poData = {
    client_id: clientId,
    po_number: `TEST-PO-${Date.now()}`,
    po_date: new Date().toISOString().split('T')[0],
    contact_person: 'Test Person',
    email_reference: 'test@example.com',
    project_name: 'Test Project',
    project_requirement: 'Test Requirement',
    drawings: [
      {
        drawing_no: `DRW-${Date.now()}`,
        revision: '0',
        description: 'Test Drawing',
        quantity: 10,
        unit: 'NOS',
        unit_rate: 100,
        line_value: 1000,
        delivery_date: new Date().toISOString().split('T')[0]
      }
    ]
  };

  try {
    console.log('Creating PO...');
    const result = await model.createFull(poData);
    console.log('PO Created Successfully:', result);
  } catch (error) {
    console.error('Failed to create PO:', error);
  } finally {
    await db.end();
  }
}

testCreatePO();
