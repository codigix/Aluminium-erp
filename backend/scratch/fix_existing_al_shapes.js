const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function fixAl() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Fetching ALIUMNINUM PLATE items from stock_balance...');
        const [stockItems] = await connection.query(
            "SELECT id, item_code, material_name FROM stock_balance WHERE material_name = 'ALIUMNINUM PLATE'"
        );
        console.log(`Found ${stockItems.length} items in stock_balance.`);

        for (const item of stockItems) {
            console.log(`Matching item: ${item.item_code}`);

            // Find matching item from material_request_items
            const [mrItems] = await connection.query(
                `SELECT shape_type, length, width, thickness, diameter, outer_diameter 
                 FROM material_request_items 
                 WHERE item_code = ? AND shape_type IS NOT NULL LIMIT 1`,
                [item.item_code]
            );

            if (mrItems.length > 0) {
                const mrItem = mrItems[0];
                console.log(`Found matching MR item with shape_type: "${mrItem.shape_type}"`);

                // Lookup shape ID in shapes table
                const [shapeRows] = await connection.query(
                    'SELECT id FROM shapes WHERE name = ? LIMIT 1',
                    [mrItem.shape_type]
                );

                if (shapeRows.length > 0) {
                    const shapeId = shapeRows[0].id;
                    console.log(`Updating stock_balance ID ${item.id} with shape_id = ${shapeId} and correct dimensions`);
                    await connection.query(
                        `UPDATE stock_balance SET 
                            shape_id = ?, 
                            length = ?, 
                            width = ?, 
                            thickness = ?, 
                            diameter = ?, 
                            outer_diameter = ?
                         WHERE id = ?`,
                        [
                            shapeId,
                            mrItem.length,
                            mrItem.width,
                            mrItem.thickness,
                            mrItem.diameter,
                            mrItem.outer_diameter,
                            item.id
                        ]
                    );
                } else {
                    console.log(`Shape "${mrItem.shape_type}" not found in shapes table.`);
                }
            } else {
                console.log(`No matching MR item found for ${item.item_code}`);
            }
        }

        console.log('Aluminum Plate shapes and dimensions fix completed successfully!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

fixAl();
