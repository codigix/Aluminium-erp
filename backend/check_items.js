const pool = require('./src/config/db');
async function run() {
    try {
        const [rows] = await pool.query('SELECT id, item_code, drawing_no, description, item_group, bom_cost FROM sales_order_items WHERE item_code = "PART-GFMBUSHMOU-0001"');
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
