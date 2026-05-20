const pool = require('./src/config/db');

async function fixQuotationCosts() {
  try {
    // 1. Find all quotation_requests where bom_cost is 0 or null, but it's a PART or SA
    const [quotes] = await pool.query(`
      SELECT id, item_code, drawing_no, item_group, bom_cost 
      FROM quotation_requests
      WHERE bom_cost = 0 OR bom_cost IS NULL
    `);

    let updatedCount = 0;

    for (const q of quotes) {
      const g = (q.item_group || '').toUpperCase();
      const isSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || g.includes('PART');
      
      if (isSA && q.item_code) {
        // Find the latest cost in sales_order_items
        const [latest] = await pool.query(`
          SELECT bom_cost FROM sales_order_items 
          WHERE item_code = ? AND bom_cost > 0
          ORDER BY id DESC LIMIT 1
        `, [q.item_code]);

        if (latest.length > 0) {
          const actualCost = latest[0].bom_cost;
          await pool.query(`
            UPDATE quotation_requests 
            SET bom_cost = ?, pending_bom_cost = NULL
            WHERE id = ?
          `, [actualCost, q.id]);
          console.log(`Updated quotation_request ${q.id} (${q.item_code}) cost to ${actualCost}`);
          updatedCount++;
        }
      }
    }
    
    console.log(`Fixed ${updatedCount} quotation requests.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

fixQuotationCosts();
