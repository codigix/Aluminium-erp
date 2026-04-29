const pool = require('./backend/src/config/db');
async function run() {
    try {
        const [rows] = await pool.query('SHOW TABLES');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
