const pool = require('./src/config/db');

async function fixQuotationCosts() {
  try {
    const [quotes] = await pool.query(`
      SELECT id, item_code, drawing_no, item_group, description, bom_cost 
      FROM quotation_requests
      WHERE status = 'COMPONENT'
    `);

    let updatedCount = 0;

    for (const q of quotes) {
      const g = (q.item_group || '').toUpperCase();
      const isSA = g.includes('SA') || g.includes('SUB') || g.includes('ASSEMBLY') || g.includes('PART');
      
      if (isSA && q.description) {
        // Find the latest cost in sales_order_items matching the description
        const [latest] = await pool.query(`
          SELECT item_code, bom_cost FROM sales_order_items 
          WHERE description = ? AND bom_cost > 0
          ORDER BY id DESC LIMIT 1
        `, [q.description]);

        if (latest.length > 0) {
          const actualCost = latest[0].bom_cost;
          const actualItemCode = latest[0].item_code;
          
          await pool.query(`
            UPDATE quotation_requests 
            SET bom_cost = ?, pending_bom_cost = NULL, item_code = ?
            WHERE id = ?
          `, [actualCost, actualItemCode, q.id]);
          console.log(`Updated quotation_request ${q.id} (${q.description}) cost to ${actualCost}, item_code to ${actualItemCode}`);
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
