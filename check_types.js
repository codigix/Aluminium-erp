const pool = require('./backend/src/config/db');

async function checkTypes() {
    try {
        const [rows] = await pool.query('SELECT DISTINCT quotation_type FROM quotation_communications');
        console.log('Quotation types in DB:', rows);
        
        const [sample] = await pool.query('SELECT * FROM quotation_communications LIMIT 5');
        console.log('Sample rows:');
        console.table(sample);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTypes();
