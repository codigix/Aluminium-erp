const mysql = require('mysql2/promise');

async function run() {
    const config = {
        host: '127.0.0.1',
        port: 3307,
        user: 'aluminium_user',
        password: 'C0digix$309',
        database: 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        const drawingNos = ['900001104', '900001105', '900001106', '900001107'];
        const [items] = await connection.query(
            'SELECT id, drawing_no, item_code, item_group, description, bom_cost, sales_order_id, status FROM sales_order_items WHERE drawing_no IN (?)',
            [drawingNos]
        );

        console.log('=== Sales Order Items ===');
        console.table(items);

        for (const item of items) {
            const [components] = await connection.query(
                'SELECT id, component_name, component_code, item_group, quantity, rate FROM sales_order_item_components WHERE sales_order_item_id = ?',
                [item.id]
            );
            if (components.length > 0) {
                console.log(`--- Components for Item ID ${item.id} (${item.drawing_no} - ${item.item_group} - ${item.description}) ---`);
                console.table(components);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

run();
