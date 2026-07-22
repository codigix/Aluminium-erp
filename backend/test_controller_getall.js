const mysql = require('mysql2/promise');
require('dotenv').config();
const materialRequestController = require('./src/controllers/materialRequestController');

async function testControllerGetAll() {
  const req = {};
  const res = {
    json: (data) => {
      console.log('=== GET ALL RESPONSE ===');
      for (const row of data.slice(0, 5)) {
        console.log(`MR ID:${row.id} (${row.mr_number || row.request_no}) Status:${row.status} => Availability: ${row.availability.toUpperCase()}`);
      }
    },
    status: (code) => ({
      json: (err) => console.error('Controller error:', code, err)
    })
  };

  try {
    await materialRequestController.getAll(req, res);
  } catch (err) {
    console.error('Error:', err);
  }
}

testControllerGetAll();
