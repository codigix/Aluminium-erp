const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'e:/codigix-project/Aluminium-erp/backend/.env' });

async function debugAvailability() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.query(`
            SELECT id, mr_number, status FROM material_requests WHERE mr_number = 'MR-20260722-002'
        `);
        const mr = rows[0];

        const [mris] = await connection.query(`
          SELECT mri.*, COALESCE(mri.shape_type, shape_lookup.shape_name) as shape_type
          FROM material_request_items mri
          LEFT JOIN (
              SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
                     MAX(s.name) as shape_name
              FROM sales_order_item_materials som
              LEFT JOIN shapes s ON som.shape_id = s.id
              GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
          ) shape_lookup ON (
              LOWER(TRIM(REPLACE(mri.item_name, '\\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\\t', '')))
              AND ABS(COALESCE(mri.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
              AND ABS(COALESCE(mri.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
              AND ABS(COALESCE(mri.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
              AND ABS(COALESCE(mri.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
              AND ABS(COALESCE(mri.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
          )
          WHERE mri.mr_id = ?
            AND UPPER(COALESCE(mri.item_type, '')) NOT IN ('FG', 'FINISHED GOOD', 'SUB_ASSEMBLY', 'SUB ASSEMBLY')
        `, [mr.id]);

        const [sbRows] = await connection.query(`
          SELECT sb.item_code, sb.material_name, sb.length, sb.width, sb.thickness, sb.diameter, sb.outer_diameter, sb.current_balance, s.name as shape_name
          FROM stock_balance sb
          LEFT JOIN shapes s ON sb.shape_id = s.id
          WHERE sb.current_balance > 0
        `);

        console.log(`Debugging MR: ${mr.mr_number} (Status: ${mr.status})`);
        
        for (const item of mris) {
            let availableStock = 0;
            const uom = (item.uom || '').toLowerCase().trim();

            let matchedList = [];

            if (uom === 'kg' || uom === 'kgs') {
              const lengthVal = parseFloat(item.length || 0);
              const widthVal = parseFloat(item.width || 0);
              const thicknessVal = parseFloat(item.thickness || 0);
              const diameterVal = parseFloat(item.diameter || 0);
              const outerDiameterVal = parseFloat(item.outer_diameter || item.outerDiameter || 0);
              const shapeLower = (item.shape_type || '').toLowerCase();

              const matchingStocks = sbRows.filter(sb => {
                const sbName = (sb.material_name || '').toLowerCase().trim();
                const itemName = (item.item_name || item.item_code || '').toLowerCase().trim();
                if (sbName !== itemName) return false;

                if (Math.abs((parseFloat(sb.length) || 0) - lengthVal) >= 0.0001) return false;

                if (shapeLower.includes('threaded rod') || shapeLower.includes('tr')) {
                  if (Math.abs((parseFloat(sb.thickness) || 0) - thicknessVal) >= 0.0001) return false;
                  if (Math.abs((parseFloat(sb.diameter) || 0) - diameterVal) >= 0.0001) return false;
                } else if ((shapeLower.includes('pipe') || shapeLower.includes('round tube') || shapeLower.includes('tube')) && !shapeLower.includes('square') && !shapeLower.includes('rectangular')) {
                  if (Math.abs((parseFloat(sb.thickness) || 0) - thicknessVal) >= 0.0001) return false;
                  if (Math.abs((parseFloat(sb.outer_diameter) || 0) - outerDiameterVal) >= 0.0001) return false;
                } else if (shapeLower.includes('round bar') || shapeLower.includes('round') || shapeLower.includes('rb') || shapeLower.includes('wire')) {
                  if (Math.abs((parseFloat(sb.diameter) || 0) - diameterVal) >= 0.0001) return false;
                } else {
                  if (Math.abs((parseFloat(sb.width) || 0) - widthVal) >= 0.0001) return false;
                  if (Math.abs((parseFloat(sb.thickness) || 0) - thicknessVal) >= 0.0001) return false;
                }

                return true;
              });

              matchedList = matchingStocks;
              availableStock = matchingStocks.reduce((sum, sb) => sum + (parseFloat(sb.current_balance) || 0), 0);
            } else {
              const matchingStocks = sbRows.filter(sb => sb.item_code === item.item_code);
              matchedList = matchingStocks;
              availableStock = matchingStocks.reduce((sum, sb) => sum + (parseFloat(sb.current_balance) || 0), 0);
            }

            const requiredQty = parseFloat(item.quantity || item.design_qty || 0);
            const releasedQty = parseFloat(item.allocated_quantity || 0);
            const remainingQty = Math.max(0, requiredQty - releasedQty);

            let itemAvailability = 'available';
            if (availableStock + 0.0001 >= remainingQty) {
              itemAvailability = 'available';
            } else {
              itemAvailability = 'unavailable';
            }

            console.log(`Item: ${item.item_code} | Shape: ${item.shape_type}`);
            console.log(`  Required: ${requiredQty} | Released: ${releasedQty} | Remaining: ${remainingQty}`);
            console.log(`  Available Stock found: ${availableStock}`);
            console.log(`  Availability: ${itemAvailability}`);
            if (matchedList.length > 0) {
                console.log(`  Matched Stock Rows:`, matchedList.map(s => `${s.item_code} (Qty: ${s.current_balance})`));
            } else {
                console.log(`  No matched stock rows!`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

debugAvailability();
