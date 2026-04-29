const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkData() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    };

    const connection = await mysql.createConnection(config);

    try {
        const [companies] = await connection.query("SELECT id, company_name FROM companies WHERE company_name LIKE '%manufacture private limited%';");
        console.log('Companies found:', companies);

        if (companies.length > 0) {
            const companyId = companies[0].id;
            const [contacts] = await connection.query("SELECT * FROM contacts WHERE company_id = ?;", [companyId]);
            console.log('Contacts found for company ID ' + companyId + ':', contacts);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkData();
