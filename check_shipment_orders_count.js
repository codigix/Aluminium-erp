const pool = require('./backend/src/config/db');
async function run() {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM shipment_orders');
        console.log('Count of shipment_orders:', rows[0].count);
        process.exit(0);
    } catch (err) {
        console.error('Error checking shipment_orders count:', err.message);
        process.exit(1);
    }
}
run();
