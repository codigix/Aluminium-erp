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
                const isKg = (item.uom || '').toLowerCase() === 'kg' || (item.uom || '').toLowerCase() === 'kgs' || (item.uom || '').toLowerCase() === 'kilogram';
                const requiredWeight = item.required_weight !== undefined 
                    ? parseFloat(item.required_weight || 0) 
                    : (isKg ? parseFloat(item.quantity || 0) : 0);

                await connection.execute(
                    `INSERT INTO procurement_rfq_items (
                        rfq_id, item_code, description, material_name, material_type, drawing_no, quantity, required_weight, planned_qty, uom,
                        length, width, thickness, diameter, outer_diameter, density, weight_per_unit, shape_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        rfq_id,
                        item.item_code || null,
                        item.description || null,
                        item.material_name || null,
                        item.material_type || null,
                        item.drawing_no || null,
                        item.quantity || 0,
                        requiredWeight,
                        item.planned_qty || 0,
                        item.uom || 'NOS',
                        item.length || 0,
                        item.width || 0,
                        item.thickness || 0,
                        item.diameter || 0,
                        item.outer_diameter || 0,
                        item.density || 0,
                        item.weight_per_unit || 0,
                        item.shape_type || item.shape_name || item.shape || null
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
const updateRfqItemVendors = async (rfqId, itemVendorMap, targetStatus = null) => {
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
        if (targetStatus === 'DRAFT') {
            newStatus = 'DRAFT';
        } else if (assigned_items === 0) {
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
              c_ord.company_name,
              c_so.company_name,
              (
                SELECT c_soi.company_name
                FROM production_plan_items ppi_so
                JOIN sales_order_items soi_so ON ppi_so.sales_order_item_id = soi_so.id
                JOIN sales_orders so_soi ON soi_so.sales_order_id = so_soi.id
                JOIN companies c_soi ON so_soi.company_id = c_soi.id
                WHERE ppi_so.plan_id = pp.id
                LIMIT 1
              ),
              (
                SELECT c_note.company_name 
                FROM sales_orders so_note 
                JOIN companies c_note ON so_note.company_id = c_note.id 
                WHERE mr.notes LIKE CONCAT('%', so_note.project_name, '%') LIMIT 1
              )
            ) as company_name,
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
     LEFT JOIN orders o ON pp.sales_order_id = o.id
     LEFT JOIN companies c_ord ON o.client_id = c_ord.id
     LEFT JOIN sales_orders so ON pp.sales_order_id = so.id
     LEFT JOIN companies c_so ON so.company_id = c_so.id
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
               COALESCE(i.material_name, sb.material_name, sb.item_description, i.item_code) as material_name,
               COALESCE(i.shape_type, shape_lookup.shape_name, (SELECT name FROM shapes WHERE id = sb.shape_id LIMIT 1)) as shape_type,
               COALESCE(i.shape_type, shape_lookup.shape_name, (SELECT name FROM shapes WHERE id = sb.shape_id LIMIT 1)) as shape_name
        FROM procurement_rfq_items i 
        JOIN procurement_rfqs r ON i.rfq_id = r.id
        LEFT JOIN (
            SELECT item_code, MAX(material_name) as material_name, MAX(item_description) as item_description,
                   MAX(shape_id) as shape_id
            FROM stock_balance GROUP BY item_code
        ) sb ON i.item_code = sb.item_code
        LEFT JOIN (
            SELECT som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter,
                   MAX(s.name) as shape_name
            FROM sales_order_item_materials som
            LEFT JOIN shapes s ON som.shape_id = s.id
            WHERE s.id IS NOT NULL
            GROUP BY som.material_name, som.length, som.width, som.thickness, som.diameter, som.outer_diameter
        ) shape_lookup ON (
            LOWER(TRIM(REPLACE(i.material_name, '\t', ''))) = LOWER(TRIM(REPLACE(shape_lookup.material_name, '\t', '')))
            AND ABS(COALESCE(i.length, 0) - COALESCE(shape_lookup.length, 0)) < 0.0001
            AND ABS(COALESCE(i.width, 0) - COALESCE(shape_lookup.width, 0)) < 0.0001
            AND ABS(COALESCE(i.thickness, 0) - COALESCE(shape_lookup.thickness, 0)) < 0.0001
            AND ABS(COALESCE(i.diameter, 0) - COALESCE(shape_lookup.diameter, 0)) < 0.0001
            AND ABS(COALESCE(i.outer_diameter, 0) - COALESCE(shape_lookup.outer_diameter, 0)) < 0.0001
        )
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
            'SELECT qi.*, q.vendor_id, v.vendor_name, q.status as quote_status, q.version as quote_version FROM quotation_items qi JOIN quotations q ON qi.quotation_id = q.id JOIN vendors v ON q.vendor_id = v.id WHERE qi.quotation_id IN (?)',
            [quoteIds]
        );
        quotationItems = qItems;
    }

    return rfqs.map(rfq => {
        const rfqItems = items.filter(i => Number(i.rfq_id) === Number(rfq.id));
        const rfqQuotes = quotations.filter(q => Number(q.rfq_id) === Number(rfq.id));
        const rfqQuoteItems = quotationItems.filter(qi => rfqQuotes.some(q => q.id === qi.quotation_id));

        const enrichedItems = rfqItems.map(item => {
            const matches = rfqQuoteItems.filter(qi => 
                (item.item_code && qi.item_code === item.item_code) ||
                (item.drawing_no && qi.drawing_no === item.drawing_no)
            );
            matches.sort((a, b) => (b.quote_version || 0) - (a.quote_version || 0));

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
                assigned_vendors: uniqueVendors,
                quote_items: matches
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

const getMergeEligibleVendors = async () => {
    const [vendors] = await pool.query(`
        SELECT v.id, v.vendor_name, v.email, COUNT(DISTINCT sub.rfq_id) as eligible_rfqs_count
        FROM vendors v
        JOIN (
            SELECT ri.vendor_id, r.id as rfq_id
            FROM procurement_rfq_items ri
            JOIN procurement_rfqs r ON ri.rfq_id = r.id
            WHERE (r.is_merged IS NULL OR r.is_merged = 0)
              AND r.status NOT IN ('MERGED', 'CANCELLED', 'CLOSED')
              AND ri.vendor_id IS NOT NULL

            UNION

            SELECT q.vendor_id, r.id as rfq_id
            FROM quotations q
            JOIN procurement_rfqs r ON q.rfq_id = r.id
            WHERE (r.is_merged IS NULL OR r.is_merged = 0)
              AND r.status NOT IN ('MERGED', 'CANCELLED', 'CLOSED')
              AND q.vendor_id IS NOT NULL
        ) sub ON v.id = sub.vendor_id
        GROUP BY v.id, v.vendor_name, v.email
        ORDER BY v.vendor_name ASC
    `);
    return vendors;
};

const getMergeEligibleRfqs = async (vendorId) => {
    if (!vendorId) return [];

    const [rfqRows] = await pool.query(`
        SELECT DISTINCT r.id
        FROM procurement_rfqs r
        LEFT JOIN procurement_rfq_items ri ON r.id = ri.rfq_id
        LEFT JOIN quotations q ON r.id = q.rfq_id
        WHERE (r.is_merged IS NULL OR r.is_merged = 0)
          AND r.status NOT IN ('MERGED', 'CANCELLED', 'CLOSED')
          AND (ri.vendor_id = ? OR q.vendor_id = ?)
    `, [vendorId, vendorId]);

    if (rfqRows.length === 0) return [];

    const rfqIds = rfqRows.map(r => r.id);
    const [rfqs] = await pool.query(
        _buildRfqQuery('WHERE r.id IN (?)'),
        [rfqIds]
    );

    const enriched = await _enrichRfqs(rfqs);

    return enriched.map(rfq => {
        const vendorItems = rfq.items.filter(i => 
            !i.vendor_id || String(i.vendor_id) === String(vendorId) ||
            (i.assigned_vendors && i.assigned_vendors.some(v => String(v.vendor_id) === String(vendorId)))
        );
        return {
            ...rfq,
            items: vendorItems.length > 0 ? vendorItems : rfq.items,
            items_count: (vendorItems.length > 0 ? vendorItems : rfq.items).length
        };
    });
};

const mergeRfqs = async (payload) => {
    const { vendorId, sourceRfqIds, items, notes, requestedBy } = payload;

    if (!vendorId) {
        throw new Error('Vendor is required');
    }
    if (!Array.isArray(sourceRfqIds) || sourceRfqIds.length < 2) {
        throw new Error('At least 2 source RFQs are required to merge');
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('At least one line item is required in the merged RFQ');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch and validate source RFQs with row locks
        const [sourceRfqs] = await connection.query(
            'SELECT * FROM procurement_rfqs WHERE id IN (?) FOR UPDATE',
            [sourceRfqIds]
        );

        if (sourceRfqs.length !== sourceRfqIds.length) {
            throw new Error('One or more source RFQs could not be found');
        }

        for (const rfq of sourceRfqs) {
            if (rfq.status === 'MERGED' || rfq.is_merged === 1) {
                throw new Error(`RFQ ${rfq.rfq_number} has already been merged`);
            }
            if (['CANCELLED', 'CLOSED'].includes(rfq.status)) {
                throw new Error(`RFQ ${rfq.rfq_number} is in status ${rfq.status} and cannot be merged`);
            }
        }

        // 2. Generate new RFQ Number
        const rfqNumber = await generateRfqNumber();

        // 3. Create consolidated RFQ Header
        const [result] = await connection.execute(
            `INSERT INTO procurement_rfqs (rfq_number, requested_by, status, notes, is_merged)
             VALUES (?, ?, 'DRAFT', ?, 1)`,
            [
                rfqNumber,
                requestedBy || null,
                notes || `Merged from: ${sourceRfqs.map(r => r.rfq_number).join(', ')}`
            ]
        );

        const newRfqId = result.insertId;

        // 4. Save merged items line-by-line preserving source RFQ references
        for (const item of items) {
            const isKg = (item.uom || item.unit || '').toLowerCase() === 'kg' || (item.uom || item.unit || '').toLowerCase() === 'kgs' || (item.uom || item.unit || '').toLowerCase() === 'kilogram';
            const requiredWeight = item.required_weight !== undefined 
                ? parseFloat(item.required_weight || 0) 
                : (isKg ? parseFloat(item.quantity || 0) : 0);

            await connection.execute(
                `INSERT INTO procurement_rfq_items (
                    rfq_id, item_code, description, material_name, material_type, drawing_no,
                    quantity, required_weight, planned_qty, uom, length, width, thickness, diameter, outer_diameter,
                    density, weight_per_unit, vendor_id, shape_type,
                    source_rfq_id, source_rfq_item_id, source_rfq_number, project_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newRfqId,
                    item.item_code || null,
                    item.description || null,
                    item.material_name || null,
                    item.material_type || null,
                    item.drawing_no || null,
                    parseFloat(item.quantity) || 0,
                    requiredWeight,
                    parseFloat(item.planned_qty) || parseFloat(item.quantity) || 0,
                    item.uom || item.unit || 'NOS',
                    parseFloat(item.length) || 0,
                    parseFloat(item.width) || 0,
                    parseFloat(item.thickness) || 0,
                    parseFloat(item.diameter) || 0,
                    parseFloat(item.outer_diameter) || 0,
                    parseFloat(item.density) || 0,
                    parseFloat(item.weight_per_unit) || 0,
                    parseInt(vendorId),
                    item.shape_type || item.shape_name || item.shape || null,
                    item.source_rfq_id ? parseInt(item.source_rfq_id) : null,
                    item.source_rfq_item_id ? parseInt(item.source_rfq_item_id) : null,
                    item.source_rfq_number || null,
                    item.project_name || null
                ]
            );
        }

        // 5. Update source RFQs status to MERGED and record linkage
        await connection.query(
            'UPDATE procurement_rfqs SET status = "MERGED", merged_into_rfq_id = ? WHERE id IN (?)',
            [newRfqId, sourceRfqIds]
        );

        await connection.commit();

        return {
            id: newRfqId,
            rfq_number: rfqNumber,
            vendor_id: parseInt(vendorId),
            source_rfqs: sourceRfqs.map(r => ({ id: r.id, rfq_number: r.rfq_number })),
            items_count: items.length
        };
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
    updateRfqItemVendors,
    getMergeEligibleVendors,
    getMergeEligibleRfqs,
    mergeRfqs
};
