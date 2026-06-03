const pool = require('./src/config/db');
async function run() {
    try {
        const [jcRows] = await pool.query("SELECT work_order_id, sequence_no FROM job_cards WHERE id = 80");
        if (jcRows.length === 0) {
            console.log('No job card 80');
            process.exit(0);
        }
        const woId = jcRows[0].work_order_id;
        console.log('Work Order ID:', woId);
        
        const [allJcs] = await pool.query("SELECT jc.id, jc.job_card_no, jc.operation_id, jc.operation_name, jc.sequence_no, jc.assigned_to, jc.status, jc.planned_qty, jc.produced_qty, jc.accepted_qty, u.username as operator_name FROM job_cards jc LEFT JOIN users u ON jc.assigned_to = u.id WHERE jc.work_order_id = ? ORDER BY jc.id", [woId]);
        console.log('Job cards ordered by id:');
        console.table(allJcs);

        const [allJcsSeq] = await pool.query("SELECT jc.id, jc.job_card_no, jc.operation_id, jc.operation_name, jc.sequence_no, jc.assigned_to, jc.status, jc.planned_qty, jc.produced_qty, jc.accepted_qty, u.username as operator_name FROM job_cards jc LEFT JOIN users u ON jc.assigned_to = u.id WHERE jc.work_order_id = ? ORDER BY jc.sequence_no, jc.id", [woId]);
        console.log('Job cards ordered by sequence_no:');
        console.table(allJcsSeq);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
