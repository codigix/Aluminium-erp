const pool = require('./backend/src/config/db');

async function check18() {
    try {
        const [rows] = await pool.query('SELECT * FROM quotation_communications WHERE id = 18');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check18();
