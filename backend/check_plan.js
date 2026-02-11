
const pool = require('./src/config/db');
pool.query('SELECT * FROM production_plans WHERE id = 11').then(([rows]) => { 
    console.log(rows[0]); 
    process.exit(0); 
}).catch(err => {
    console.error(err);
    process.exit(1);
});
