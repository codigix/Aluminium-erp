require('dotenv').config();
const pool = require('./src/config/db');
pool.query('DESCRIBE operations').then(([rows]) => {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
