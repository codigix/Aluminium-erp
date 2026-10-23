// Playwright API tests. They run against a separate backend instance on port 5055 that is
// pointed at the spTech_dev database, so real production data (spTech_prod) is never touched.
const { defineConfig } = require('@playwright/test');

const TEST_PORT = 5055;
const TEST_DB = process.env.TEST_DB_NAME || 'spTech_dev';

module.exports = defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`
  },
  webServer: {
    command: 'node src/server.js',
    // Any protected route answers 401 once the server is up, which Playwright treats as ready
    url: `http://127.0.0.1:${TEST_PORT}/job-cards`,
    reuseExistingServer: false,
    timeout: 180000,
    env: { PORT: String(TEST_PORT), DB_NAME: TEST_DB }
  }
});
