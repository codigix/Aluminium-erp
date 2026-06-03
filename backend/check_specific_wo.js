const pool = require('./src/config/db');
const jobCardService = require('./src/services/jobCardService');

async function run() {
    try {
        console.log("Running syncUnaccountedDowntime...");
        await jobCardService.syncUnaccountedDowntime(114);
        console.log("Sync finished.");
        
        const [rows] = await pool.query("SELECT * FROM job_card_downtime_logs WHERE job_card_id = 114");
        console.log("Downtime logs after sync:", rows);
        
        process.exit(0);
    } catch (err) {
        console.error("Error running script:", err);
        process.exit(1);
    }
}
run();


