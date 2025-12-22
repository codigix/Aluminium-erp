import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend root
const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('DB Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0
});

async function insertMockData() {
  let connection;
  try {
    connection = await createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: 'backend', // Hardcoding based on .env file content
      database: process.env.DB_NAME || 'aluminium_erp',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Connected to database');

    // 1. Create Items (Product and Components)
    const items = [
      {
        item_code: 'FG-AL-WINDOW-001',
        name: 'Aluminium Sliding Window 4x4',
        item_group: 'Products',
        description: 'Standard 4x4 Aluminium Sliding Window with Glass',
        uom: 'Nos',
        valuation_rate: 5000,
        standard_selling_rate: 8500,
        maintain_stock: 1,
        is_active: 1
      },
      {
        item_code: 'RM-AL-PROFILE-001',
        name: 'Aluminium Profile Section A',
        item_group: 'Raw Material',
        description: 'Extruded Aluminium Profile Section A',
        uom: 'Meters',
        valuation_rate: 450,
        standard_selling_rate: 0,
        maintain_stock: 1,
        is_active: 1
      },
      {
        item_code: 'RM-GLASS-PANE-001',
        name: 'Toughened Glass 4mm',
        item_group: 'Raw Material',
        description: '4mm Toughened Glass Pane',
        uom: 'Sq. Ft',
        valuation_rate: 120,
        standard_selling_rate: 0,
        maintain_stock: 1,
        is_active: 1
      },
      {
        item_code: 'RM-RUBBER-SEAL-001',
        name: 'EPDM Rubber Seal',
        item_group: 'Raw Material',
        description: 'Black EPDM Rubber Seal',
        uom: 'Meters',
        valuation_rate: 15,
        standard_selling_rate: 0,
        maintain_stock: 1,
        is_active: 1
      },
      {
        item_code: 'SCRAP-AL-001',
        name: 'Aluminium Scrap',
        item_group: 'Scrap',
        description: 'Aluminium Cuttings and Scrap',
        uom: 'Kg',
        valuation_rate: 100,
        standard_selling_rate: 120,
        maintain_stock: 1,
        is_active: 1
      }
    ];

    console.log('Inserting Items...');
    for (const item of items) {
      // Check if item exists
      const [existing] = await connection.execute('SELECT item_code FROM item WHERE item_code = ?', [item.item_code]);
      
      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO item (item_code, name, item_group, description, uom, valuation_rate, standard_selling_rate, maintain_stock, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.item_code, item.name, item.item_group, item.description, item.uom, item.valuation_rate, item.standard_selling_rate, item.maintain_stock, item.is_active]
        );
        console.log(`Created item: ${item.item_code}`);
      } else {
        console.log(`Item already exists: ${item.item_code}`);
      }
    }

    // 2. Create BOM Header
    const bomId = 'BOM-FG-AL-WINDOW-001';
    console.log(`Creating BOM: ${bomId}...`);

    // Delete existing BOM to ensure clean slate
    await connection.execute('DELETE FROM bom_line WHERE bom_id = ?', [bomId]);
    await connection.execute('DELETE FROM bom_operation WHERE bom_id = ?', [bomId]);
    await connection.execute('DELETE FROM bom_scrap WHERE bom_id = ?', [bomId]);
    await connection.execute('DELETE FROM bom WHERE bom_id = ?', [bomId]);

    // Insert BOM
    try {
        await connection.execute(
        `INSERT INTO bom (bom_id, item_code, product_name, description, quantity, uom, status, revision, effective_date, created_by, process_loss_percentage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            bomId,
            'FG-AL-WINDOW-001',
            'Aluminium Sliding Window 4x4',
            'BOM for Standard 4x4 Window',
            1,
            'Nos',
            'Active',
            '1.0',
            new Date(),
            'Admin',
            2.5
        ]
        );
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
             // Fallback for older schema
             await connection.execute(
                `INSERT INTO bom (bom_id, item_code, description, quantity, uom, status, revision, effective_date, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    bomId,
                    'FG-AL-WINDOW-001',
                    'BOM for Standard 4x4 Window',
                    1,
                    'Nos',
                    'Active',
                    '1.0',
                    new Date(),
                    'Admin'
                ]
                );
        } else {
            throw err;
        }
    }
    console.log('BOM Header created');

    // 3. Create BOM Lines
    const bomLines = [
      {
        component_code: 'RM-AL-PROFILE-001',
        quantity: 12.5,
        uom: 'Meters',
        component_description: 'Aluminium Profile Section A',
        component_type: 'Raw Material',
        sequence: 1,
        notes: 'Cut to size',
        warehouse: 'Stores - A',
        operation: 'Cutting'
      },
      {
        component_code: 'RM-GLASS-PANE-001',
        quantity: 16,
        uom: 'Sq. Ft',
        component_description: 'Toughened Glass 4mm',
        component_type: 'Raw Material',
        sequence: 2,
        notes: 'Handle with care',
        warehouse: 'Stores - A',
        operation: 'Assembly'
      },
      {
        component_code: 'RM-RUBBER-SEAL-001',
        quantity: 13,
        uom: 'Meters',
        component_description: 'EPDM Rubber Seal',
        component_type: 'Raw Material',
        sequence: 3,
        notes: 'Black color',
        warehouse: 'Stores - A',
        operation: 'Assembly'
      }
    ];

    console.log('Inserting BOM Lines...');
    for (const line of bomLines) {
        try {
            await connection.execute(
                `INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, notes, warehouse, operation)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [bomId, line.component_code, line.quantity, line.uom, line.component_description, line.component_type, line.sequence, line.notes, line.warehouse, line.operation]
            );
        } catch (err) {
             if (err.code === 'ER_BAD_FIELD_ERROR') {
                await connection.execute(
                    `INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [bomId, line.component_code, line.quantity, line.uom, line.component_description, line.component_type, line.sequence, line.notes]
                );
             } else {
                 throw err;
             }
        }
    }
    console.log('BOM Lines created');

    // 4. Create BOM Operations
    const bomOperations = [
      {
        operation_name: 'Cutting',
        workstation_type: 'Cutting Station',
        operation_time: 45,
        fixed_time: 10,
        operating_cost: 250,
        sequence: 1,
        notes: 'Cut profiles to length'
      },
      {
        operation_name: 'Assembly',
        workstation_type: 'Assembly Bench',
        operation_time: 90,
        fixed_time: 15,
        operating_cost: 400,
        sequence: 2,
        notes: 'Assemble frame and glass'
      }
    ];

    console.log('Inserting BOM Operations...');
    for (const op of bomOperations) {
      await connection.execute(
        `INSERT INTO bom_operation (bom_id, operation_name, workstation_type, operation_time, fixed_time, operating_cost, sequence, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [bomId, op.operation_name, op.workstation_type, op.operation_time, op.fixed_time, op.operating_cost, op.sequence, op.notes]
      );
    }
    console.log('BOM Operations created');

    // 5. Create BOM Scrap
    const bomScrap = [
      {
        item_code: 'SCRAP-AL-001',
        item_name: 'Aluminium Scrap',
        quantity: 0.5,
        rate: 100,
        sequence: 1
      }
    ];

    console.log('Inserting BOM Scrap...');
    for (const scrap of bomScrap) {
      await connection.execute(
        `INSERT INTO bom_scrap (bom_id, item_code, item_name, quantity, rate, sequence)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bomId, scrap.item_code, scrap.item_name, scrap.quantity, scrap.rate, scrap.sequence]
      );
    }
    console.log('BOM Scrap created');

    console.log('✓ Mock Data Insertion Complete!');
    process.exit(0);

  } catch (error) {
    console.error('Error inserting mock data:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

insertMockData();
