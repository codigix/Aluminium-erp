
const pool = require('./src/config/db');
async function run() {
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM work_orders');
        console.log('Total work orders:', rows[0].count);
        
        const [lastRows] = await pool.query('SELECT * FROM work_orders ORDER BY id DESC LIMIT 5');
        console.log('Last 5 work orders:');
        console.table(lastRows.map(r => ({id: r.id, wo: r.wo_number, item: r.item_code, type: r.source_type, plan: r.plan_id})));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
