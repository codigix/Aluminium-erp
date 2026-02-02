const pool = require('./backend/src/config/db');

async function checkReq() {
    try {
        const [rows] = await pool.query('SELECT * FROM quotation_requests WHERE id = 20');
        console.log('Quotation Request 20:', rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkReq();
