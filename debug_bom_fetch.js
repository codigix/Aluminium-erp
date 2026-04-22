const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });
const productionPlanService = require('./backend/src/services/productionPlanService');

async function test() {
    try {
        const orderId = 3;
        console.log(`Fetching details for Order ID: ${orderId}`);
        const details = await productionPlanService.getSalesOrderFullDetails(orderId);
        
        if (details) {
            console.log('Order Details found.');
            console.log('Items Count:', details.items.length);
            console.log('Items Sample:', JSON.stringify(details.items.slice(0, 2), null, 2));
            
            const boms = details.items.map(item => ({
                id: item.id,
                sales_order_item_id: item.sales_order_item_id,
                item_code: item.item_code,
                description: item.description
            }));
            
            console.log('BOMs for dropdown:', JSON.stringify(boms, null, 2));
            
            const filtered = boms.filter(bom => bom && (bom.id || bom.sales_order_item_id));
            console.log('Filtered BOMs Count:', filtered.length);
        } else {
            console.log('Order Details NOT found.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

test();
