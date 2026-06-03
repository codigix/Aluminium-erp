const pool = require('./src/config/db');
async function run() {
    try {
        await pool.query("UPDATE job_card_quality_logs SET inspected_qty = 40.000 WHERE id = 14");
        await pool.query("UPDATE job_card_quality_logs SET inspected_qty = 30.000 WHERE id = 15");
        console.log("Database records updated successfully.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();


