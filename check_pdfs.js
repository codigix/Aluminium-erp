const pool = require('./backend/src/config/db');

async function checkPdfs() {
    try {
        const [rows] = await pool.query('SELECT id, status, reply_pdf FROM quotation_requests WHERE id IN (20, 17, 15, 14, 13, 12, 11, 7)');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkPdfs();
