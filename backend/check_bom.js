const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function check() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'spTech_dev'
    };

    const connection = await mysql.createConnection(config);

    try {
        const poIds = [48, 51];

        for (const poId of poIds) {
            console.log(`\n--- PO ID: ${poId} ---`);
            const [poRows] = await connection.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
            const po = poRows[0];

            const [items] = await connection.query(
                `SELECT 
                  poi.id,
                  poi.item_code,
                  poi.material_name,
                  poi.drawing_no as poi_drawing_no,
                  COALESCE(
                    NULLIF(NULLIF(TRIM(poi.drawing_no), TRIM(poi.item_code)), ''),
                    (
                      SELECT NULLIF(ppm.bom_ref, '')
                      FROM material_requests mr
                      JOIN production_plan_materials ppm ON mr.plan_id = ppm.plan_id
                      WHERE mr.id = po.mr_id
                      AND LOWER(TRIM(ppm.material_name)) = LOWER(TRIM(poi.material_name))
                      LIMIT 1
                    ),
                    (
                      SELECT NULLIF(ppm.bom_ref, '')
                      FROM purchase_order_items poi_src
                      JOIN material_requests mr ON poi_src.mr_id = mr.id
                      JOIN production_plan_materials ppm ON mr.plan_id = ppm.plan_id
                      WHERE poi_src.id = poi.source_po_item_id
                      AND LOWER(TRIM(ppm.material_name)) = LOWER(TRIM(poi.material_name))
                      LIMIT 1
                    ),
                    (
                      SELECT NULLIF(ppm.bom_ref, '')
                      FROM production_plans pp
                      JOIN production_plan_materials ppm ON pp.id = ppm.plan_id
                      WHERE pp.sales_order_id = po.sales_order_id
                      AND LOWER(TRIM(ppm.material_name)) = LOWER(TRIM(poi.material_name))
                      LIMIT 1
                    ),
                    (
                      SELECT NULLIF(soi.drawing_no, soi.item_code)
                      FROM sales_order_items soi 
                      WHERE soi.sales_order_id = po.sales_order_id
                      AND soi.item_code = poi.item_code
                      LIMIT 1
                    ),
                    (
                      SELECT NULLIF(COALESCE(soi.drawing_no, oi.drawing_no), ppi.item_code)
                      FROM material_requests mr
                      JOIN production_plans pp ON mr.plan_id = pp.id
                      JOIN production_plan_items ppi ON pp.id = ppi.plan_id
                      LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
                      LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id AND ppi.sales_order_id = oi.order_id
                      WHERE mr.id = po.mr_id
                      LIMIT 1
                    ),
                    (
                      SELECT NULLIF(COALESCE(soi.drawing_no, oi.drawing_no), ppi.item_code)
                      FROM production_plans pp
                      JOIN production_plan_items ppi ON pp.id = ppi.plan_id
                      LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
                      LEFT JOIN order_items oi ON ppi.sales_order_item_id = oi.id AND ppi.sales_order_id = oi.order_id
                      WHERE pp.sales_order_id = po.sales_order_id
                      LIMIT 1
                    )
                  ) as resolved_drawing_no
                 FROM purchase_order_items poi
                 LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
                 WHERE poi.purchase_order_id = ?`,
                [poId]
            );

            console.log(items);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

check();
