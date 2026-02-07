const pool = require('./backend/src/config/db');

async function checkBatchComms() {
    try {
        const batchIds = [20, 21, 22, 23];
        console.log(`Checking communications for batch IDs: ${batchIds.join(', ')}`);
        const [rows] = await pool.query(
            'SELECT id, quotation_id, sender_type, message, email_message_id, created_at FROM quotation_communications WHERE quotation_id IN (?) ORDER BY created_at ASC',
            [batchIds]
        );
        console.table(rows);
        
        const [unread] = await pool.query(
            'SELECT quotation_id, COUNT(*) as count FROM quotation_communications WHERE quotation_type = "CLIENT" AND is_read = 0 GROUP BY quotation_id'
        );
        console.log('Unread counts:');
        console.table(unread);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkBatchComms();
