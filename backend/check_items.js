const pool = require('./src/config/db');
async function run() {
    try {
        console.log('--- Fetch company 5 details ---');
        const [company] = await pool.query(`SELECT * FROM companies WHERE id = 5`);
        console.log(company);

        console.log('--- Fetch contacts of company 5 ---');
        const [contacts] = await pool.query(`SELECT * FROM contacts WHERE company_id = 5`);
        console.log(contacts);

        console.log('--- Fetch addresses of company 5 ---');
        const [addresses] = await pool.query(`SELECT * FROM company_addresses WHERE company_id = 5`);
        console.log(addresses);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();




