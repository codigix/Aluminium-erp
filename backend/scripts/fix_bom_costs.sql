-- ==========================================
-- FIX BOM COSTS - Calculate from line items
-- ==========================================

-- Update bom table with calculated costs from line items
UPDATE bom b
SET total_cost = (
    SELECT COALESCE(SUM(amount), 0)
    FROM bom_line bl
    WHERE bl.bom_id = b.bom_id
)
WHERE total_cost = 0 OR total_cost IS NULL;

-- For BOMs without line items, set a default cost
UPDATE bom 
SET total_cost = 1000.00 
WHERE total_cost = 0 OR total_cost IS NULL;

-- Verify the update
SELECT 
    bom_id, 
    product_name, 
    status, 
    total_cost,
    (SELECT COUNT(*) FROM bom_line bl WHERE bl.bom_id = bom.bom_id) as line_count,
    (SELECT COUNT(*) FROM bom_operation bo WHERE bo.bom_id = bom.bom_id) as operation_count
FROM bom
ORDER BY created_at DESC;
