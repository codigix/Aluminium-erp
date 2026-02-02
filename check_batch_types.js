const pool = require('./backend/src/config/db');

async function checkBatchTypes() {
    try {
        const [rows] = await pool.query('SELECT id, quotation_id, quotation_type FROM quotation_communications WHERE quotation_id IN (20, 21, 22, 23)');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkBatchTypes();
