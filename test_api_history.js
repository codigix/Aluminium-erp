(async () => {
    // const API_BASE = 'http://localhost:5000/api';
    console.log('Testing service directly with ID 89...');
    
    const bomService = require('./backend/src/services/bomService');
    try {
        const history = await bomService.getBOMHistory(null, null, 89);
        console.log('History count:', history.length);
        console.log('History data:', JSON.stringify(history, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        // Force exit because pool keeps it open
        process.exit();
    }
})();
