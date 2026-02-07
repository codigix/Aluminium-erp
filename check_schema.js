const mysql = require('mysql2/promise');
async function run() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'Aluminium_erp'
    });
    try {
        const [columns] = await pool.query('DESCRIBE quotation_communications');
        console.log('Columns:', columns.map(c => c.Field));
        const [rows] = await pool.query('SELECT * FROM quotation_communications LIMIT 1');
        console.log('Sample row:', rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
