const bomService = require('./src/services/bomService');
const pool = require('./src/config/db');

async function run() {
    try {
        const rows = await bomService.getItemComponents(94, 'ASSEMBLY-SUPPORTFLA-0001', '04261098201');
        console.log("FINAL ROWS:", JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
