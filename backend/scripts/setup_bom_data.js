#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aluminium_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function setupBOMData() {
  let connection;

  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully');

    console.log('\n📊 Checking existing data...');
    const [existingBOMs] = await connection.execute('SELECT COUNT(*) as count FROM bom');
    const bomCount = existingBOMs[0].count;
    console.log(`   Current BOMs: ${bomCount}`);

    const [existingLines] = await connection.execute('SELECT COUNT(*) as count FROM bom_line');
    console.log(`   Current BOM Lines: ${existingLines[0].count}`);

    const [existingOps] = await connection.execute('SELECT COUNT(*) as count FROM bom_operation');
    console.log(`   Current BOM Operations: ${existingOps[0].count}`);

    const [existingScrap] = await connection.execute('SELECT COUNT(*) as count FROM bom_scrap');
    console.log(`   Current BOM Scrap Items: ${existingScrap[0].count}`);

    // Read and execute the SQL script
    console.log('\n📝 Reading SQL script...');
    const sqlPath = path.join(__dirname, 'insert_bom_mock_data.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split into individual statements and execute
    console.log('\n⏳ Inserting BOM data...');
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let insertCount = 0;
    for (const statement of statements) {
      if (statement.includes('INSERT INTO')) {
        await connection.execute(statement);
        insertCount++;
      }
    }

    console.log(`✅ Inserted ${insertCount} records`);

    // Verify insertion
    console.log('\n📊 Verifying inserted data...');
    const [newBOMs] = await connection.execute('SELECT COUNT(*) as count FROM bom');
    console.log(`   Total BOMs: ${newBOMs[0].count}`);

    const [newLines] = await connection.execute('SELECT COUNT(*) as count FROM bom_line');
    console.log(`   Total BOM Lines: ${newLines[0].count}`);

    const [newOps] = await connection.execute('SELECT COUNT(*) as count FROM bom_operation');
    console.log(`   Total BOM Operations: ${newOps[0].count}`);

    const [newScrap] = await connection.execute('SELECT COUNT(*) as count FROM bom_scrap');
    console.log(`   Total BOM Scrap Items: ${newScrap[0].count}`);

    // Get summary by BOM
    console.log('\n📋 BOM Summary:');
    const [summary] = await connection.execute(`
      SELECT 
        b.bom_id, 
        b.item_code, 
        b.product_name, 
        b.status,
        b.total_cost,
        COUNT(DISTINCT bl.line_id) as material_count,
        COUNT(DISTINCT bo.operation_id) as operation_count,
        COUNT(DISTINCT bs.scrap_id) as scrap_count
      FROM bom b
      LEFT JOIN bom_line bl ON b.bom_id = bl.bom_id
      LEFT JOIN bom_operation bo ON b.bom_id = bo.bom_id
      LEFT JOIN bom_scrap bs ON b.bom_id = bs.bom_id
      GROUP BY b.bom_id
      ORDER BY b.created_at DESC
    `);

    console.log('\n┌─────────────────────────┬──────────────────┬────────┬─────────┬──────────┬──────────┐');
    console.log('│ BOM ID                  │ Product          │ Status │ Cost    │ Materials│ Operations│');
    console.log('├─────────────────────────┼──────────────────┼────────┼─────────┼──────────┼──────────┤');
    
    for (const row of summary) {
      const bomId = row.bom_id.padEnd(23);
      const product = (row.product_name || 'N/A').substring(0, 16).padEnd(16);
      const status = (row.status || 'Draft').padEnd(6);
      const cost = (row.total_cost || 0).toFixed(0).padStart(7);
      const materials = (row.material_count || 0).toString().padStart(8);
      const operations = (row.operation_count || 0).toString().padStart(8);
      
      console.log(`│ ${bomId} │ ${product} │ ${status} │ ₹${cost} │ ${materials} │ ${operations} │`);
    }
    console.log('└─────────────────────────┴──────────────────┴────────┴─────────┴──────────┴──────────┘');

    // Test API endpoint simulation
    console.log('\n🧪 API Endpoint Test (Simulated):');
    console.log('   GET /production/boms - Returns all BOMs');
    console.log(`   ✅ Would return ${newBOMs[0].count} BOMs`);
    console.log('   GET /production/boms/:bom_id - Returns BOM with details');
    console.log('   POST /production/boms - Create new BOM');
    console.log('   PUT /production/boms/:bom_id - Update BOM');
    console.log('   DELETE /production/boms/:bom_id - Delete BOM');

    console.log('\n🎉 BOM data setup completed successfully!');
    console.log('\n📱 Next steps:');
    console.log('   1. Start the backend: npm start');
    console.log('   2. Navigate to: http://localhost:5173/production/boms');
    console.log('   3. You should see all inserted BOMs in the list');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('   Database connection was closed');
    }
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Access denied - check DB credentials');
    }
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   Database does not exist');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupBOMData();
