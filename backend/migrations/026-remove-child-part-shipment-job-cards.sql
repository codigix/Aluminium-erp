-- ============================================================
-- Migration: 026-remove-child-part-shipment-job-cards.sql
-- Purpose: Remove redundant Shipment/Dispatch Job Cards from internal child parts
--          in Assembly BOMs while preserving parent Assembly/FG and standalone part dispatches.
-- Date:    2026-10-13
-- ============================================================

-- Safely delete redundant Shipment/Dispatch Job Cards for internal child parts/sub-assemblies
-- Only removes records where no production, accepted, or dispatch quantities exist,
-- and where no shipment orders are linked.
DELETE jc
FROM job_cards jc
JOIN work_orders wo ON jc.work_order_id = wo.id
WHERE LOWER(TRIM(jc.operation_name)) IN ('shipment', 'dispatch')
  AND (
    wo.parent_wo_id IS NOT NULL 
    OR wo.source_type = 'SA'
    OR (
      wo.source_fg IS NOT NULL 
      AND UPPER(TRIM(wo.source_fg)) != UPPER(TRIM(wo.item_code))
      AND UPPER(TRIM(wo.source_fg)) != UPPER(TRIM(wo.item_name))
    )
    OR EXISTS (
      SELECT 1 FROM work_orders pwo 
      WHERE pwo.plan_id = wo.plan_id 
        AND pwo.source_type = 'FG' 
        AND pwo.id != wo.id
    )
  )
  AND COALESCE(jc.produced_qty, 0) = 0
  AND COALESCE(jc.accepted_qty, 0) = 0
  AND COALESCE(jc.dispatch_qty, 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM shipment_orders so WHERE so.job_card_id = jc.id
  );
