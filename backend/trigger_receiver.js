const { processEmails } = require('./src/utils/realEmailReceiver');
async function run() {
  console.log('Manually triggering email processing...');
  try {
    await processEmails();
    console.log('Manual trigger complete.');
    process.exit(0);
  } catch (e) {
    console.error('Manual trigger failed:', e);
    process.exit(1);
  }
}
run();
