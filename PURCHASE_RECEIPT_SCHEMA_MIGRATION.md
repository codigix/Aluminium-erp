# Purchase Receipt Schema Migration - Completed ✅

## Problem
The `purchase_receipt_item` table had a schema mismatch:
- **Old schema (init.sql)**: Used `id INT AUTO_INCREMENT PRIMARY KEY`
- **New schema (database.sql)**: Expected `grn_item_id VARCHAR(50) PRIMARY KEY`
- **Error**: `Unknown column 'pri.grn_item_id' in 'field list'` when fetching GRNs

## Root Cause
The system was initialized with `init.sql` (old schema) but the application code evolved to use `database.sql` (new schema). This is the same issue that previously affected `material_request_item` table.

## Solution Implemented
Created and executed `backend/scripts/fix-purchase-receipt-schema.js` which:

1. ✅ Removed AUTO_INCREMENT from old `id` column
2. ✅ Dropped old `id` primary key
3. ✅ Made `grn_item_id` the primary key
4. ✅ Dropped old `id` column
5. ✅ Added `created_at` timestamp column
6. ✅ Added index on `grn_no` column

## Final Schema
```sql
CREATE TABLE purchase_receipt_item (
  grn_item_id VARCHAR(50) PRIMARY KEY,
  grn_no VARCHAR(50) NOT NULL (indexed),
  item_code VARCHAR(100) NOT NULL (indexed),
  received_qty DECIMAL(10,2),
  accepted_qty DECIMAL(10,2),
  rejected_qty DECIMAL(10,2),
  warehouse_code VARCHAR(50),
  batch_no VARCHAR(100),
  quality_inspection_required TINYINT(1),
  created_at TIMESTAMP
)
```

## Migration Status
✅ **Complete** - Schema successfully migrated

## How to Run Migration
```bash
cd backend
node scripts/fix-purchase-receipt-schema.js
```

The script is:
- **Idempotent** - Can be run multiple times safely
- **Progressive** - Handles partial migrations gracefully
- **Verified** - Confirms schema changes before and after

## Related Issues
- This fixes the companion issue to Material Request item schema migration
- Part of broader dual-schema problem requiring systematic resolution
- Recommend implementing migration framework (Flyway, db-migrate) for future changes

## Files Modified
- Created: `backend/scripts/fix-purchase-receipt-schema.js`
- Affected: `backend/src/models/PurchaseReceiptModel.js` (queries now work)

## Testing
Purchase Receipt module endpoints should now work without schema errors:
- GET /purchase-receipts (list all)
- GET /purchase-receipts/:grn_no (fetch specific GRN)
- POST /purchase-receipts (create new)
- PUT /purchase-receipts/:grn_no (update)