const pool = require('../config/db');

const generateRfqNumber = async () => {
    const timestamp = Date.now();
    return `RFQ-${timestamp}`;
};

const createRfq = async (payload) => {
    const { mr_id, requested_by, notes, items } = payload;
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const rfq_number = await generateRfqNumber();
        
        const [result] = await connection.execute(
            'INSERT INTO procurement_rfqs (rfq_number, mr_id, requested_by, notes) VALUES (?, ?, ?, ?)',
            [rfq_number, mr_id, requested_by, notes || null]
        );

        const rfq_id = result.insertId;

        if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                await connection.execute(
                    `INSERT INTO procurement_rfq_items (rfq_id, item_code, description, material_name, material_type, drawing_no, quantity, uom)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        rfq_id,
                        item.item_code || null,
                        item.description || null,
                        item.material_name || null,
                        item.material_type || null,
                        item.drawing_no || null,
                        item.quantity || 0,
                        item.uom || 'NOS'
                    ]
                );
            }
        }

        // Update Material Request status to PROCESSING
        await connection.execute(
            'UPDATE material_requests SET status = ? WHERE id = ?',
            ['PROCESSING', mr_id]
        );

        await connection.commit();
        return { id: rfq_id, rfq_number };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const getRfqsByMrId = async (mrId) => {
    const [rfqs] = await pool.query(
        'SELECT r.*, u.username as requester_name FROM procurement_rfqs r LEFT JOIN users u ON r.requested_by = u.id WHERE r.mr_id = ? ORDER BY r.created_at DESC',
        [mrId]
    );

    const [items] = await pool.query(`
        SELECT i.*, 
               COALESCE(i.material_name, sb.material_name, sb.item_description, i.item_code) as material_name
        FROM procurement_rfq_items i 
        JOIN procurement_rfqs r ON i.rfq_id = r.id 
        LEFT JOIN (
            SELECT item_code, MAX(material_name) as material_name, MAX(item_description) as item_description 
            FROM stock_balance GROUP BY item_code
        ) sb ON i.item_code = sb.item_code
        WHERE r.mr_id = ?`,
        [mrId]
    );

    // Get linked quotations
    const [quotations] = await pool.query(
        'SELECT q.*, v.vendor_name FROM quotations q JOIN vendors v ON q.vendor_id = v.id WHERE q.rfq_id IN (SELECT id FROM procurement_rfqs WHERE mr_id = ?)',
        [mrId]
    );

    return rfqs.map(rfq => ({
        ...rfq,
        items: items.filter(i => i.rfq_id === rfq.id),
        quotations: quotations.filter(q => q.rfq_id === rfq.id)
    }));
};

const getRfqs = async () => {
    const [rfqs] = await pool.query(
        'SELECT r.*, u.username as requester_name, mr.mr_number FROM procurement_rfqs r LEFT JOIN users u ON r.requested_by = u.id LEFT JOIN material_requests mr ON r.mr_id = mr.id ORDER BY r.created_at DESC'
    );

    const [items] = await pool.query(`
        SELECT i.*, 
               COALESCE(i.material_name, sb.material_name, sb.item_description, i.item_code) as material_name
        FROM procurement_rfq_items i
        LEFT JOIN (
            SELECT item_code, MAX(material_name) as material_name, MAX(item_description) as item_description 
            FROM stock_balance GROUP BY item_code
        ) sb ON i.item_code = sb.item_code
    `);

    const [quotations] = await pool.query(
        'SELECT q.*, v.vendor_name FROM quotations q JOIN vendors v ON q.vendor_id = v.id WHERE q.rfq_id IS NOT NULL'
    );

    return rfqs.map(rfq => ({
        ...rfq,
        items: items.filter(i => i.rfq_id === rfq.id),
        quotations: quotations.filter(q => q.rfq_id === rfq.id)
    }));
};

module.exports = {
    createRfq,
    getRfqsByMrId,
    getRfqs
};
