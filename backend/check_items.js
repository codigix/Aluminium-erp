const pool = require('./src/config/db');
async function run() {
    try {
        const [rows] = await pool.query(`
            SELECT id, company_id, status, current_department 
            FROM sales_orders 
            ORDER BY id DESC LIMIT 10
        `);
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
