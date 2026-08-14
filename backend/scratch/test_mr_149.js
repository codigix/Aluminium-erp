const pool = require('../src/config/db');
const materialRequestController = require('../src/controllers/materialRequestController');

(async () => {
  try {
    const req = { params: { id: 149 }, query: {} };
    const res = {
      status: (code) => ({
        json: (data) => console.log('STATUS:', code, data)
      }),
      json: (data) => {
        console.log('--- Material Request 149 Items ---');
        data.items.forEach(it => {
          console.log(`ID: ${it.id} | Code: ${it.item_code} | Name: ${it.name} | Shape: ${it.shape_type} | L: ${it.length} | W: ${it.width} | T: ${it.thickness} | D: ${it.diameter} | OD: ${it.outer_diameter} | Stock: ${it.total_stock} | Weight: ${it.total_weight}`);
        });
      }
    };
    await materialRequestController.getById(req, res);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
