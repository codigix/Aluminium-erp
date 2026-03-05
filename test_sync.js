const path = require('path');
const fs = require('fs');

// Try to find the correct node_modules
const backendPath = path.join(__dirname, 'backend');
const nodeModulesPath = path.join(backendPath, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
    console.error(`Backend node_modules not found at ${nodeModulesPath}`);
    process.exit(1);
}

// Manually add backend/node_modules to the module paths
module.paths.unshift(nodeModulesPath);

require('dotenv').config({ path: path.join(backendPath, '.env') });
const receiver = require('./backend/src/utils/realEmailReceiver');

async function test() {
    console.log('Starting manual sync test...');
    try {
        await receiver.processEmails();
        console.log('Manual sync test complete.');
    } catch (error) {
        console.error('Error during manual sync:', error);
    }
    process.exit(0);
}

test();
