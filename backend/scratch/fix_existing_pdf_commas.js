const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function fixCommas() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Scanning database for commas in pdf_path...');

        // 1. Check po_receipts
        const [receipts] = await connection.query("SELECT id, pdf_path FROM po_receipts WHERE pdf_path LIKE '%,%'");
        console.log(`Found ${receipts.length} po_receipts with commas.`);

        for (const receipt of receipts) {
            const originalPath = receipt.pdf_path;
            const newPath = originalPath.replace(/,/g, '_');
            
            // Rename file physically
            const originalFull = path.join('e:/codigix-project/Aluminium-erp/backend', originalPath);
            const newFull = path.join('e:/codigix-project/Aluminium-erp/backend', newPath);

            if (fs.existsSync(originalFull)) {
                console.log(`Renaming: ${originalFull} -> ${newFull}`);
                fs.renameSync(originalFull, newFull);
            } else {
                console.log(`File not found physically: ${originalFull}`);
            }

            console.log(`Updating DB for receipt ${receipt.id}: ${newPath}`);
            await connection.query('UPDATE po_receipts SET pdf_path = ? WHERE id = ?', [newPath, receipt.id]);
        }

        // 2. Check customer_pos
        const [customerPOs] = await connection.query("SELECT id, pdf_path FROM customer_pos WHERE pdf_path LIKE '%,%'");
        console.log(`Found ${customerPOs.length} customer_pos with commas.`);
        for (const po of customerPOs) {
            const originalPath = po.pdf_path;
            const newPath = originalPath.replace(/,/g, '_');

            const originalFull = path.join('e:/codigix-project/Aluminium-erp/backend', originalPath);
            const newFull = path.join('e:/codigix-project/Aluminium-erp/backend', newPath);

            if (fs.existsSync(originalFull)) {
                console.log(`Renaming: ${originalFull} -> ${newFull}`);
                fs.renameSync(originalFull, newFull);
            }

            await connection.query('UPDATE customer_pos SET pdf_path = ? WHERE id = ?', [newPath, po.id]);
        }

        // 3. Check quotations
        const [quotations] = await connection.query("SELECT id, received_pdf_path FROM quotations WHERE received_pdf_path LIKE '%,%'");
        console.log(`Found ${quotations.length} quotations with commas.`);
        for (const q of quotations) {
            const originalPath = q.received_pdf_path;
            const newPath = originalPath.replace(/,/g, '_');

            const originalFull = path.join('e:/codigix-project/Aluminium-erp/backend', originalPath);
            const newFull = path.join('e:/codigix-project/Aluminium-erp/backend', newPath);

            if (fs.existsSync(originalFull)) {
                console.log(`Renaming: ${originalFull} -> ${newFull}`);
                fs.renameSync(originalFull, newFull);
            }

            await connection.query('UPDATE quotations SET received_pdf_path = ? WHERE id = ?', [newPath, q.id]);
        }

        console.log('Comma cleanup completed successfully!');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await connection.end();
    }
}

fixCommas();
