const mysql = require('mysql2/promise');  
const pool = mysql.createPool({host: 'localhost', user: 'root', password: 'backend', database: 'sales_erp'});  
pool.query('SELECT id, warehouse_name FROM warehouses').then(([rows]) => { console.log(JSON.stringify(rows)); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });  
