const mysql = require('mysql2/promise');

async function searchDB(port, user, password, dbName) {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port,
      user,
      password,
      database: dbName
    });
    console.log(`\n=== Database: ${dbName} (Port ${port}) ===`);

    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);

    for (const table of ['stock_balance', 'items', 'materials', 'customer_drawings']) {
      if (tableNames.includes(table)) {
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        console.log(`Table '${table}' count: ${rows[0].count}`);
        
        if (rows[0].count > 0) {
          const [sample] = await connection.query(`SELECT * FROM \`${table}\` LIMIT 3`);
          console.log(`Sample from '${table}':`, sample.map(s => {
            if (table === 'customer_drawings') return { drawing_no: s.drawing_no, project_name: s.project_name };
            return { item_code: s.item_code || s.material_code || s.code, name: s.material_name || s.item_name || s.name || s.drawing_no };
          }));
        }
      }
    }
    
    // Check if we can find 'PART-SSGRFMOUNT-0001' or 'RM-MSSHEET-0001' in any of these tables
    for (const table of ['stock_balance', 'items', 'materials']) {
      if (tableNames.includes(table)) {
        const [foundCorrect] = await connection.query(`SELECT * FROM \`${table}\` WHERE item_code LIKE '%SSGRF%' OR item_code LIKE '%PART-SSGRFMOUNT%'`);
        if (foundCorrect.length > 0) {
          console.log(`FOUND CORRECT DATA IN '${table}':`, foundCorrect);
        }
        const [foundWrong] = await connection.query(`SELECT * FROM \`${table}\` WHERE item_code LIKE '%MSSHEET%' OR item_code LIKE '%RM-MSSHEET%'`);
        if (foundWrong.length > 0) {
          console.log(`FOUND DEFAULT DATA IN '${table}':`, foundWrong);
        }
      }
    }

    await connection.end();
  } catch (err) {
    console.log(`FAILED to search DB ${dbName}. Error:`, err.message);
  }
}

async function run() {
  await searchDB(3307, 'aluminium_user', 'C0digix$309', 'spTech_dev');
  await searchDB(3306, 'root', '', 'sales_erp');
}

run();
