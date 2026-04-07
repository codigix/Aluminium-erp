const app = require('./app');
const emailReceiver = require('./utils/realEmailReceiver');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Sales ERP backend running on port ${PORT}`);
  
  // Start real email receiver to fetch replies
  try {
    emailReceiver.startEmailReceiver();
  } catch (error) {
    console.error('[Server] Failed to start email receiver:', error.message);
  }
}); // restarted for migration
