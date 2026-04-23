const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

(async () => {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3307,
        user: process.env.DB_USER || 'aluminium_user',
        password: process.env.DB_PASSWORD || 'C0digix$309',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const pool = await mysql.createPool(config);
    
    async function getBOMHistory(itemCode, drawingNo, itemId = null) {
        let effectiveItemCode = itemCode;
        let effectiveDrawingNo = drawingNo;
        let effectiveBomId = null;

        console.log(`[getBOMHistory] Input - itemCode: ${itemCode}, drawingNo: ${drawingNo}, itemId: ${itemId}`);

        if (itemId) {
            const [itemRows] = await pool.query(
                'SELECT item_code, drawing_no, bom_id FROM sales_order_items WHERE id = ?',
                [itemId]
            );
            if (itemRows.length > 0) {
                effectiveItemCode = effectiveItemCode || itemRows[0].item_code;
                effectiveDrawingNo = effectiveDrawingNo || itemRows[0].drawing_no;
                effectiveBomId = itemRows[0].bom_id;
                console.log(`[getBOMHistory] Resolved - bomId: ${effectiveBomId}`);
            }
        }

        const queryParams = [];
        let whereClause = '';
        
        if (effectiveBomId) {
            whereClause = 'soi.bom_id = ?';
            queryParams.push(effectiveBomId);
        } else {
            return [];
        }

        const sql = `
            SELECT 
                soi.id,
                soi.revision_no as version,
                soi.status,
                soi.updated_at as revision_date,
                soi.bom_cost as total_cost
            FROM sales_order_items soi
            WHERE ${whereClause}
            ORDER BY (CASE WHEN soi.id = ? THEN 0 ELSE 1 END) ASC, soi.updated_at DESC, soi.id DESC
        `;
        
        queryParams.push(itemId);
        
        const [rows] = await pool.query(sql, queryParams);
        return rows;
    }

    try {
        const history = await getBOMHistory(null, null, 89);
        console.log('History for ID 89:', history);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
})();
