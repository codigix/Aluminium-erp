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
                    `INSERT INTO procurement_rfq_items (
                        rfq_id, item_code, description, material_name, material_type, drawing_no, quantity, planned_qty, uom,
                        length, width, thickness, diameter, outer_diameter, density, weight_per_unit
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        rfq_id,
                        item.item_code || null,
                        item.description || null,
                        item.material_name || null,
                        item.material_type || null,
                        item.drawing_no || null,
                        item.quantity || 0,
                        item.planned_qty || 0,
                        item.uom || 'NOS',
                        item.length || 0,
                        item.width || 0,
                        item.thickness || 0,
                        item.diameter || 0,
                        item.outer_diameter || 0,
                        item.density || 0,
                        item.weight_per_unit || 0
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

/**
 * Assign per-item vendor IDs and update RFQ status accordingly.
 * itemVendorMap: { [rfq_item_id]: [vendor_id_1, vendor_id_2] }
 */
const updateRfqItemVendors = async (rfqId, itemVendorMap) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Update each item's vendor_id
        for (const [itemId, vendorIds] of Object.entries(itemVendorMap)) {
            const vIds = Array.isArray(vendorIds) ? vendorIds : (vendorIds ? [vendorIds] : []);
            const primaryVendorId = vIds.length > 0 ? parseInt(vIds[0]) : null;

            await connection.execute(
                'UPDATE procurement_rfq_items SET vendor_id = ? WHERE id = ? AND rfq_id = ?',
                [primaryVendorId, parseInt(itemId), parseInt(rfqId)]
            );
        }

        // 2. Count total vs assigned items for this RFQ
        const [countRows] = await connection.execute(
            `SELECT 
                COUNT(*) AS total_items,
                SUM(CASE WHEN vendor_id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_items
             FROM procurement_rfq_items WHERE rfq_id = ?`,
            [parseInt(rfqId)]
        );

        const { total_items, assigned_items } = countRows[0];

        // 3. Determine new status
        let newStatus;
        if (assigned_items === 0) {
            newStatus = 'DRAFT'; // No vendors assigned
        } else if (assigned_items < total_items) {
            newStatus = 'PENDING_ITEMS'; // Partial assignment
        } else {
            newStatus = 'SENT'; // All items assigned
        }

        await connection.execute(
            'UPDATE procurement_rfqs SET status = ? WHERE id = ?',
            [newStatus, parseInt(rfqId)]
        );

        await connection.commit();
        return { total_items, assigned_items, status: newStatus };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const _buildRfqQuery = (whereClause) => `
    SELECT r.*, u.username as requester_name, mr.mr_number, 
            COALESCE(
              (
                SELECT COALESCE(soi.drawing_no, oi.drawing_no, ppi_dr.item_code)
                FROM production_plan_items ppi_dr
                LEFT JOIN sales_order_items soi ON ppi_dr.sales_order_item_id = soi.id
                LEFT JOIN order_items oi ON ppi_dr.sales_order_item_id = oi.id AND ppi_dr.sales_order_id = oi.order_id
                WHERE ppi_dr.plan_id = pp.id
                LIMIT 1
              ),
              pp.bom_no
            ) as drawing_no,
            ppi.description as finished_good,
            COALESCE(
              (
                SELECT so.project_name 
                FROM production_plans pp
                LEFT JOIN (
                  SELECT plan_id, sales_order_item_id FROM production_plan_items
                  WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
                ) ppi ON pp.id = ppi.plan_id
                LEFT JOIN sales_order_items soi ON ppi.sales_order_item_id = soi.id
                LEFT JOIN sales_orders so ON (
                  (soi.id IS NOT NULL AND soi.sales_order_id = so.id) OR
                  (soi.id IS NULL AND pp.sales_order_id = so.id)
                )
                WHERE pp.id = mr.plan_id
              ),
              (
                SELECT o.project_name 
                FROM production_plans pp
                JOIN orders o ON pp.sales_order_id = o.id AND o.source_type = 'DIRECT'
                WHERE pp.id = mr.plan_id
              ),
              mr.purpose, 
              'General Procurement'
            ) as project_name
     FROM procurement_rfqs r 
     LEFT JOIN users u ON r.requested_by = u.id 
     LEFT JOIN material_requests mr ON r.mr_id = mr.id 
     LEFT JOIN production_plans pp ON mr.plan_id = pp.id
     LEFT JOIN (
       SELECT plan_id, description FROM production_plan_items
       WHERE id IN (SELECT MIN(id) FROM production_plan_items GROUP BY plan_id)
     ) ppi ON pp.id = ppi.plan_id
     ${whereClause}
     ORDER BY r.created_at DESC`;

const _enrichRfqs = async (rfqs) => {
    if (rfqs.length === 0) return [];

    const rfqIds = rfqs.map(r => r.id);

    const [items] = await pool.query(`
        SELECT i.*, 
               COALESCE(i.material_name, sb.material_name, sb.item_description, i.item_code) as material_name
        FROM procurement_rfq_items i 
        JOIN procurement_rfqs r ON i.rfq_id = r.id
        LEFT JOIN (
            SELECT item_code, MAX(material_name) as material_name, MAX(item_description) as item_description 
            FROM stock_balance GROUP BY item_code
        ) sb ON i.item_code = sb.item_code
        WHERE i.rfq_id IN (?)
        AND (r.mr_id IS NULL OR EXISTS (
            SELECT 1 FROM material_request_items mri 
            WHERE mri.mr_id = r.mr_id AND mri.item_code = i.item_code
        ))`,
        [rfqIds]
    );

    // Get linked quotations
    const [quotations] = await pool.query(
        'SELECT q.*, v.vendor_name FROM quotations q JOIN vendors v ON q.vendor_id = v.id WHERE q.rfq_id IN (?)',
        [rfqIds]
    );

    let quotationItems = [];
    if (quotations.length > 0) {
        const quoteIds = quotations.map(q => q.id);
        const [qItems] = await pool.query(
            'SELECT qi.*, q.vendor_id, v.vendor_name FROM quotation_items qi JOIN quotations q ON qi.quotation_id = q.id JOIN vendors v ON q.vendor_id = v.id WHERE qi.quotation_id IN (?)',
            [quoteIds]
        );
        quotationItems = qItems;
    }

    return rfqs.map(rfq => {
        const rfqItems = items.filter(i => Number(i.rfq_id) === Number(rfq.id));
        const rfqQuotes = quotations.filter(q => Number(q.rfq_id) === Number(rfq.id));
        const rfqQuoteItems = quotationItems.filter(qi => rfqQuotes.some(q => q.id === qi.quotation_id));

        const enrichedItems = rfqItems.map(item => {
            const matches = rfqQuoteItems.filter(qi => qi.item_code === item.item_code || qi.drawing_no === item.drawing_no);
            const assignedVendors = matches.map(m => ({
                vendor_id: m.vendor_id,
                vendor_name: m.vendor_name
            }));
            
            const uniqueVendors = [];
            const seen = new Set();
            for (const v of assignedVendors) {
                if (!seen.has(v.vendor_id)) {
                    seen.add(v.vendor_id);
                    uniqueVendors.push(v);
                }
            }

            return {
                ...item,
                assigned_vendors: uniqueVendors
            };
        });

        const totalItems = enrichedItems.length;
        const assignedItems = enrichedItems.filter(i => i.assigned_vendors.length > 0 || i.vendor_id != null).length;

        return {
            ...rfq,
            items: enrichedItems,
            quotations: rfqQuotes,
            total_items: totalItems,
            assigned_items: assignedItems,
            pending_items: totalItems - assignedItems
        };
    });
};

const getRfqById = async (id) => {
    const [rfqs] = await pool.query(
        _buildRfqQuery('WHERE r.id = ?'),
        [id]
    );
    if (rfqs.length === 0) return null;
    const enriched = await _enrichRfqs(rfqs);
    return enriched[0];
};

const getRfqsByMrId = async (mrId) => {
    const [rfqs] = await pool.query(
        _buildRfqQuery('WHERE r.mr_id = ?'),
        [mrId]
    );
    return _enrichRfqs(rfqs);
};

const getRfqs = async () => {
    const [rfqs] = await pool.query(_buildRfqQuery(''));
    return _enrichRfqs(rfqs);
};

const deleteRfq = async (id) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete items first
        await connection.execute('DELETE FROM procurement_rfq_items WHERE rfq_id = ?', [id]);

        // 2. Delete RFQ
        const [result] = await connection.execute('DELETE FROM procurement_rfqs WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            throw new Error('RFQ not found');
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    createRfq,
    getRfqById,
    getRfqsByMrId,
    getRfqs,
    deleteRfq,
    updateRfqItemVendors
};
