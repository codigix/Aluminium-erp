const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function fixStockShapes() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Fetching stock_balance items without shape_id...');
        const [stockItems] = await connection.query('SELECT item_code, material_name, length, width, thickness, diameter, outer_diameter FROM stock_balance WHERE shape_id IS NULL');
        console.log(`Found ${stockItems.length} items without shape_id.`);

        for (const item of stockItems) {
            console.log(`Checking shape_type for item: ${item.item_code} (${item.material_name})`);

            // Try to find shape_type from grn_items joined with purchase_order_items
            const [grnItems] = await connection.query(
                `SELECT gi.shape_type FROM grn_items gi
                 LEFT JOIN purchase_order_items poi ON gi.po_item_id = poi.id
                 WHERE poi.item_code = ? OR (
                    ABS(COALESCE(gi.length, 0) - COALESCE(?, 0)) < 0.0001
                    AND ABS(COALESCE(gi.width, 0) - COALESCE(?, 0)) < 0.0001
                    AND ABS(COALESCE(gi.thickness, 0) - COALESCE(?, 0)) < 0.0001
                    AND ABS(COALESCE(gi.diameter, 0) - COALESCE(?, 0)) < 0.0001
                    AND ABS(COALESCE(gi.outer_diameter, 0) - COALESCE(?, 0)) < 0.0001
                 ) LIMIT 1`,
                [item.item_code, item.length || 0, item.width || 0, item.thickness || 0, item.diameter || 0, item.outer_diameter || 0]
            );

            let shapeType = grnItems.length > 0 ? grnItems[0].shape_type : null;

            if (!shapeType) {
                // Try from purchase_order_items
                const [poItems] = await connection.query(
                    `SELECT shape_type FROM purchase_order_items 
                     WHERE item_code = ? LIMIT 1`,
                    [item.item_code]
                );
                shapeType = poItems.length > 0 ? poItems[0].shape_type : null;
            }

            if (!shapeType) {
                // Try from material_request_items
                const [mrItems] = await connection.query(
                    `SELECT shape_type FROM material_request_items 
                     WHERE item_code = ? LIMIT 1`,
                    [item.item_code]
                );
                shapeType = mrItems.length > 0 ? mrItems[0].shape_type : null;
            }

            if (!shapeType) {
                // Guess shape from material name (e.g. Pipe, Rod, Tube, Threaded Rod)
                const nameLower = (item.material_name || '').toLowerCase();
                if (nameLower.includes('threaded rod') || nameLower.includes(' rod')) {
                    shapeType = 'TR';
                } else if (nameLower.includes('pipe') || nameLower.includes('round tube')) {
                    shapeType = 'PIPE';
                } else if (nameLower.includes('square tube')) {
                    shapeType = 'SQT';
                } else if (nameLower.includes('flat bar') || nameLower.includes('flat')) {
                    shapeType = 'FB';
                }
            }

            if (shapeType) {
                console.log(`Found shape_type: "${shapeType}" for ${item.item_code}`);
                const [shapeRows] = await connection.query(
                    'SELECT id FROM shapes WHERE name = ? LIMIT 1',
                    [shapeType]
                );
                if (shapeRows.length > 0) {
                    const shapeId = shapeRows[0].id;
                    console.log(`Updating ${item.item_code} with shape_id = ${shapeId}`);
                    await connection.query('UPDATE stock_balance SET shape_id = ? WHERE item_code = ?', [shapeId, item.item_code]);
                } else {
                    console.log(`Shape "${shapeType}" not found in shapes table.`);
                }
            } else {
                console.log(`Could not determine shape_type for ${item.item_code}`);
            }
        }

        console.log('Stock balance shapes fix completed successfully!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

fixStockShapes();
