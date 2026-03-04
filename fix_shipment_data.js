const pool = require('./backend/src/config/db');

async function fixShipmentOrders() {
    try {
        console.log('Fixing orders for SHIPMENT department...');
        
        // Find some orders that are in production or completed
        const [orders] = await pool.query("SELECT id, status, current_department FROM sales_orders LIMIT 5");
        
        if (orders.length === 0) {
            console.log('No orders found to update.');
            return;
        }

        for (const order of orders) {
            console.log(`Updating order ${order.id} (current status: ${order.status}) to SHIPMENT`);
            await pool.execute(
                "UPDATE sales_orders SET status = 'READY_FOR_SHIPMENT', current_department = 'SHIPMENT', request_accepted = 0 WHERE id = ?",
                [order.id]
            );
        }

        console.log('Done! 5 orders moved to SHIPMENT (Incoming).');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixShipmentOrders();
