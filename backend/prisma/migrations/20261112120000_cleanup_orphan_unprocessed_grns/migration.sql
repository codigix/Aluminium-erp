-- Clean up GRN records left behind when a Goods Receipt was deleted with the old delete (it removed only the
-- po_receipts row). Such leftovers still counted as "received", kept the PO at FULFILLED and hid it from GRN.
--
-- Removed ONLY when the GRN never progressed:
--   * its po_receipts row no longer exists
--   * GRN status is PENDING
--   * it has an auto-created QC record that is still PENDING with no stock update (current GRN flow)
--   * no stock ledger row, warehouse allocation or stock entry came from it
-- Older leftovers (QC passed, stock posted, or pre-QC records) are NOT touched.
-- grn_items, qc_inspections (+ items / attachments) and excess approvals go with the GRN (FK ON DELETE CASCADE).
-- Then the affected POs get the same status the app calculates (FULFILLED / PARTIALLY_RECEIVED / ORDERED);
-- POs already in payment / closed states are not touched. Safe to run more than once.

DROP TEMPORARY TABLE IF EXISTS tmp_orphan_grns;
CREATE TEMPORARY TABLE tmp_orphan_grns (id INT PRIMARY KEY, po_id INT NULL);

INSERT INTO tmp_orphan_grns (id, po_id)
SELECT g.id, (SELECT po.id FROM purchase_orders po WHERE po.po_number = g.po_number LIMIT 1)
FROM grns g
WHERE g.po_receipt_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM po_receipts pr WHERE pr.id = g.po_receipt_id)
  AND UPPER(COALESCE(g.status, '')) = 'PENDING'
  AND EXISTS (SELECT 1 FROM qc_inspections q WHERE q.grn_id = g.id)
  AND NOT EXISTS (
    SELECT 1 FROM qc_inspections q
    WHERE q.grn_id = g.id AND (UPPER(COALESCE(q.status, '')) NOT IN ('', 'PENDING') OR COALESCE(q.stock_updated, 0) = 1)
  )
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl
    WHERE sl.grn_item_id IN (SELECT gi.id FROM grn_items gi WHERE gi.grn_id = g.id)
       OR sl.qc_id IN (SELECT q.id FROM qc_inspections q WHERE q.grn_id = g.id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM warehouse_allocations wa
    WHERE wa.grn_item_id IN (SELECT gi.id FROM grn_items gi WHERE gi.grn_id = g.id)
  )
  AND NOT EXISTS (SELECT 1 FROM stock_entries se WHERE se.grn_id = g.id);

DROP TEMPORARY TABLE IF EXISTS tmp_affected_pos;
CREATE TEMPORARY TABLE tmp_affected_pos (id INT PRIMARY KEY);
INSERT IGNORE INTO tmp_affected_pos (id)
SELECT t.po_id FROM tmp_orphan_grns t WHERE t.po_id IS NOT NULL;

DELETE g FROM grns g JOIN tmp_orphan_grns t ON t.id = g.id;

-- Recalculate the affected POs exactly like poBalanceService.calculatePOBalance
DROP TEMPORARY TABLE IF EXISTS tmp_line_received;
CREATE TEMPORARY TABLE tmp_line_received AS
SELECT poi.id,
       poi.purchase_order_id,
       COALESCE(poi.design_qty, poi.planned_qty, 0) AS design_qty,
       COALESCE(poi.quantity, 0) AS req_weight,
       COALESCE(SUM(COALESCE(gi.receiving_qty, gi.received_qty, gi.accepted_qty, 0)), 0) AS rec_qty,
       COALESCE(SUM(COALESCE(gi.receiving_weight, gi.received_weight, gi.received_qty, 0)), 0) AS rec_weight
FROM purchase_order_items poi
JOIN tmp_affected_pos p ON p.id = poi.purchase_order_id
LEFT JOIN grn_items gi ON gi.po_item_id = poi.id
GROUP BY poi.id, poi.purchase_order_id, poi.design_qty, poi.planned_qty, poi.quantity;

UPDATE purchase_order_items poi
JOIN tmp_line_received l ON l.id = poi.id
SET poi.status = IF(GREATEST(l.design_qty - l.rec_qty, 0) <= 0.0005 AND GREATEST(l.req_weight - l.rec_weight, 0) <= 0.0005, 'CLOSED', 'OPEN');

DROP TEMPORARY TABLE IF EXISTS tmp_po_received;
CREATE TEMPORARY TABLE tmp_po_received AS
SELECT purchase_order_id,
       COUNT(*) AS line_count,
       SUM(GREATEST(design_qty - rec_qty, 0) <= 0.0005 AND GREATEST(req_weight - rec_weight, 0) <= 0.0005) AS closed_count,
       SUM(rec_qty > 0 OR rec_weight > 0) AS received_count
FROM tmp_line_received
GROUP BY purchase_order_id;

UPDATE purchase_orders po
JOIN tmp_po_received r ON r.purchase_order_id = po.id
SET po.status = IF(r.closed_count = r.line_count AND r.line_count > 0, 'FULFILLED',
                   IF(r.received_count > 0, 'PARTIALLY_RECEIVED', 'ORDERED'))
WHERE po.status IN ('FULFILLED', 'PARTIALLY_RECEIVED', 'ORDERED', 'RECEIVED');

DROP TEMPORARY TABLE IF EXISTS tmp_po_received;
DROP TEMPORARY TABLE IF EXISTS tmp_line_received;
DROP TEMPORARY TABLE IF EXISTS tmp_affected_pos;
DROP TEMPORARY TABLE IF EXISTS tmp_orphan_grns;
