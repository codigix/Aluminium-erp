require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/src/config/db');
pool.query('DESCRIBE sales_order_items').then(([rows]) => {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
