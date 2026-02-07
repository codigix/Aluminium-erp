ALTER TABLE stock_ledger
MODIFY transaction_type ENUM('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'GRN_IN') NOT NULL;

ALTER TABLE stock_ledger
ADD COLUMN IF NOT EXISTS qc_id INT AFTER reference_doc_number;

ALTER TABLE stock_ledger
ADD COLUMN IF NOT EXISTS grn_item_id INT AFTER qc_id;

ALTER TABLE stock_ledger
ADD INDEX IF NOT EXISTS idx_qc_id (qc_id);

ALTER TABLE stock_ledger
ADD UNIQUE KEY IF NOT EXISTS unique_grn_ledger (reference_doc_id, grn_item_id, transaction_type);
