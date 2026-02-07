try {
  console.log('Starting app load test...');
  const app = require('./src/app');
  console.log('App loaded successfully');
} catch (error) {
  console.error('Error loading app:');
  console.error(error);
}
