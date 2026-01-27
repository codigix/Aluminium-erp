const mysql = require('mysql2/promise');

async function checkTimeline() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'aluminium_user',
    password: 'C0digix$309',
    database: 'sales_erp',
    port: 3307
  });

  try {
    const salesOrderId = 1;
    console.log(`--- Timeline for SO ${salesOrderId} ---`);
    const [items] = await connection.query(
      `SELECT soi.*, sb.material_type as item_group 
       FROM sales_order_items soi
       LEFT JOIN stock_balance sb ON sb.item_code = soi.item_code
       WHERE soi.sales_order_id = ?`,
      [salesOrderId]
    );
    
    console.log(`Total items found: ${items.length}`);
    const activeItems = items.filter(item => item.status !== 'REJECTED');
    console.log(`Active items (not REJECTED): ${activeItems.length}`);
    
    if (activeItems.length > 0) {
        console.log('First 5 active items:');
        console.table(activeItems.slice(0, 5).map(i => ({
            id: i.id,
            item_code: i.item_code,
            drawing_no: i.drawing_no,
            status: i.status,
            item_group: i.item_group
        })));
    }

    const drawingGroups = activeItems.reduce((acc, item) => {
        const cleanText = (text) => text ? text.replace(/\s*\(.*$/, '').trim() : '';
        const dwgNo = cleanText(item.drawing_no || 'N/A');
        const key = dwgNo;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    console.log(`\nDrawing Groups count: ${Object.keys(drawingGroups).length}`);
    console.log('Drawing Groups summary:');
    console.table(Object.keys(drawingGroups).slice(0, 10).map(dwg => ({
        drawing_no: dwg,
        items_count: drawingGroups[dwg].length
    })));

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

checkTimeline();
