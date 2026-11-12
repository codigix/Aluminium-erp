-- Rows labelled "round" / "threaded rod" that have NO diameter / OD but do have width + thickness + length are
-- really plates (the label was a wrong guess from stock data, shown as "TR Mnull × T × L mm").
-- Only the shape label is corrected → plate. Quantities, weights, rates, balances and ledger amounts are untouched.
-- BOM tables are not touched. Safe to run more than once (corrected rows no longer match).

SET @plate_id = (SELECT id FROM shapes WHERE LOWER(TRIM(name)) = 'plate' ORDER BY id LIMIT 1);

-- Stock balance (shape label and shape id)
UPDATE stock_balance
SET shape_type = 'plate', shape_id = COALESCE(@plate_id, shape_id)
WHERE (LOWER(TRIM(COALESCE(shape_type, ''))) IN ('round', 'threaded rod')
       OR (COALESCE(shape_type, '') = '' AND shape_id IN (SELECT id FROM shapes WHERE LOWER(TRIM(name)) IN ('round', 'threaded rod'))))
  AND COALESCE(diameter, 0) = 0 AND COALESCE(outer_diameter, 0) = 0
  AND COALESCE(width, 0) > 0 AND COALESCE(thickness, 0) > 0 AND COALESCE(length, 0) > 0;

-- Stock ledger (label only)
UPDATE stock_ledger
SET shape_type = 'plate'
WHERE LOWER(TRIM(COALESCE(shape_type, ''))) IN ('round', 'threaded rod')
  AND COALESCE(diameter, 0) = 0 AND COALESCE(outer_diameter, 0) = 0
  AND COALESCE(width, 0) > 0 AND COALESCE(thickness, 0) > 0 AND COALESCE(length, 0) > 0;

-- GRN lines
UPDATE grn_items
SET shape_type = 'plate'
WHERE LOWER(TRIM(COALESCE(shape_type, ''))) IN ('round', 'threaded rod')
  AND COALESCE(diameter, 0) = 0 AND COALESCE(outer_diameter, 0) = 0
  AND COALESCE(width, 0) > 0 AND COALESCE(thickness, 0) > 0 AND COALESCE(length, 0) > 0;

-- Purchase order lines
UPDATE purchase_order_items
SET shape_type = 'plate'
WHERE LOWER(TRIM(COALESCE(shape_type, ''))) IN ('round', 'threaded rod')
  AND COALESCE(diameter, 0) = 0 AND COALESCE(outer_diameter, 0) = 0
  AND COALESCE(width, 0) > 0 AND COALESCE(thickness, 0) > 0 AND COALESCE(length, 0) > 0;

-- Stock entry lines (label and shape id)
UPDATE stock_entry_items
SET shape_type = 'plate', shape_id = COALESCE(@plate_id, shape_id)
WHERE LOWER(TRIM(COALESCE(shape_type, ''))) IN ('round', 'threaded rod')
  AND COALESCE(diameter, 0) = 0 AND COALESCE(outer_diameter, 0) = 0
  AND COALESCE(width, 0) > 0 AND COALESCE(thickness, 0) > 0 AND COALESCE(length, 0) > 0;
