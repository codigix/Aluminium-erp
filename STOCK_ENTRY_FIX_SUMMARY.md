# Stock Entry Creation Fix - Complete Summary

## Issue
When attempting to create a stock entry through the Stock Entries modal form, users received a **500 Internal Server Error**:
```
Failed to create stock entry: Unknown column 'id' in 'field list'
```

## Root Cause Analysis
The database schema revealed a critical architectural mismatch:
- **Item table** (`item`): Uses `item_code` (VARCHAR) as primary key, **NOT** a numeric `id` column
- **Stock tables** (`stock_entry_items`, `stock_balance`, `stock_ledger`): Were designed with `item_code` columns
- **Backend code** (`StockEntryModel.js`): Was attempting to SELECT `id` from the `item` table, which doesn't exist

## Actual Database Schema
```
item table columns:
- item_code (VARCHAR(100), PRIMARY KEY)  ← Only identifier, no 'id' column
- name, description, uom, gst_rate, etc.

stock_entry_items table columns:
- id (INT, PRIMARY KEY)
- stock_entry_id (INT)
- item_code (VARCHAR(100))  ← Foreign key to item.item_code
- qty, uom, valuation_rate, batch_no, etc.
```

## Solutions Implemented

### 1. **Frontend Fixes** (StockEntries.jsx)
Fixed multiple data type consistency issues:
- **Warehouse ID handling**: Convert warehouse IDs to strings when passing through select dropdowns
  ```javascript
  value={String(wh.id)}  // Ensure consistent string comparison
  ```
- **Item name fallback**: Handle both `name` and `item_name` fields
  ```javascript
  {item.name || item.item_name}
  ```
- **Filter logic**: Fixed warehouse filter to check both `warehouse_id` and `to_warehouse_id`
  ```javascript
  String(entry.warehouse_id || entry.to_warehouse_id) === warehouseFilter
  ```
- **Type filter**: Added GRN option to filter dropdown
- **Form submission**: Convert numeric IDs before sending to API
  ```javascript
  from_warehouse_id: formData.from_warehouse_id ? Number(formData.from_warehouse_id) : null,
  to_warehouse_id: formData.to_warehouse_id ? Number(formData.to_warehouse_id) : null
  ```

### 2. **Backend Fixes** (StockEntryModel.js)

#### Create Method (Lines 198-222)
**Before**: Tried to SELECT both `id` and `item_code` from item table
```javascript
const [itemRows] = await connection.query(
  'SELECT id, item_code FROM item WHERE item_code = ?',
  [item.item_code]
)
const itemRecord = itemRows[0]
// Later: used itemRecord.id which didn't exist
```

**After**: Only SELECT `item_code` (which exists)
```javascript
const [itemRows] = await connection.query(
  'SELECT item_code FROM item WHERE item_code = ?',
  [item.item_code]
)
```

#### Submit Method (Lines 309-357)
**Before**: Tried to query `item.id` and had complex try-catch fallback logic
```javascript
const [itemIdRows] = await connection.query(
  'SELECT id FROM item WHERE item_code = ?',  // ← FAILS: id doesn't exist
  [itemCode]
)
const itemId = itemIdRows[0]?.id
```

**After**: Removed unnecessary id queries entirely, simplified to just use item_code
```javascript
// Directly use itemCode in all queries
await connection.query(
  `INSERT INTO stock_ledger (
    item_code, warehouse_id, transaction_date, transaction_type,
    qty_in, qty_out, valuation_rate, reference_doctype, reference_name,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [itemCode, warehouseId, transactionDate, transactionType, ...]
)
```

#### Stock Balance Updates (Lines 333-358)
**Before**: Complex try-catch with fallback to non-existent `item_id`
```javascript
try {
  // Try item_code
} catch (e) {
  if (e.message.includes("Unknown column 'item_code'")) {
    // Fall back to item_id  ← itemId is undefined
  }
}
```

**After**: Single clean query using item_code
```javascript
const [existingBalanceRows] = await connection.query(
  `SELECT current_qty, reserved_qty FROM stock_balance WHERE item_code = ? AND warehouse_id = ?`,
  [itemCode, warehouseId]
)
```

## Testing Workflow

The system now correctly handles the complete stock entry creation workflow:

1. **Manual Entry Modal Opens**
   - User clicks "Manual Entry" button
   - Form displays with proper warehouse dropdowns

2. **GRN Selection (Optional)**
   - User selects an approved GRN
   - Items auto-populate with correct item_codes
   - Entry type auto-sets to "Material Receipt"

3. **Form Submission**
   - Frontend validates warehouse is selected
   - Frontend converts all IDs to correct types
   - Sends API request to `/api/stock/entries`

4. **Backend Processing**
   - Creates stock entry record
   - Inserts items into `stock_entry_items` (uses `item_code`)
   - Auto-submits for GRN-based entries:
     - Creates ledger entry in `stock_ledger`
     - Updates `stock_balance` with new quantities
   - Returns created entry

5. **Frontend Update**
   - Shows success message
   - Refreshes stock entries list
   - Modal closes

## Key Technical Insights

1. **The Aluminium ERP system consistently uses `item_code` as the primary identifier for items throughout all modules** - no numeric IDs

2. **Database schema is correct**: All three tables (`stock_entry_items`, `stock_balance`, `stock_ledger`) already have `item_code` columns and proper foreign key relationships

3. **Backend fallback logic was unnecessary**: The defensive try-catch blocks that attempted to fall back from `item_code` to `item_id` weren't working because:
   - `item_id` columns don't exist in these tables
   - The `item` table has no `id` column to reference
   - Simplified approach is more reliable

4. **Type consistency matters**: Warehouse IDs and GRN IDs need proper type conversion (string to number) when passed between frontend and backend

## Files Modified

1. **Frontend**:
   - `d:\projects\Aluminium-erp\frontend\src\pages\Inventory\StockEntries.jsx`
     - Fixed warehouse select dropdowns
     - Fixed item name display
     - Added GRN filter option
     - Added ID type conversion in submit handler

2. **Backend**:
   - `d:\projects\Aluminium-erp\backend\src\models\StockEntryModel.js`
     - Removed non-existent `id` column queries from item table
     - Simplified create method (removed unused itemRecord variable)
     - Simplified submit method (removed itemId queries and fallback logic)
     - Removed try-catch fallback logic from stock_balance updates
     - Cleaned up stock_ledger inserts

## Files Created (for testing/diagnostics)

- `STOCK_ENTRY_TEST_PLAN.md` - Comprehensive test procedures
- `backend/test-stock-entry.js` - Automated API test suite
- `backend/run-fix-migration.js` - Safe migration runner
- `backend/smart-migration.js` - Schema-aware migration tool
- `backend/check-schema.js` - Schema diagnostic tool
- `backend/diagnose.js` - Detailed schema inspector

## Validation

To verify the fix is working:

1. **Test through UI**:
   ```
   1. Log in as inventory user
   2. Go to Inventory → Stock Entries
   3. Click "Manual Entry"
   4. Select a GRN request
   5. Select destination warehouse
   6. Click "Create Entry"
   → Should succeed with "Stock entry created successfully" message
   ```

2. **Test via API**:
   ```bash
   curl -X POST http://localhost:3000/api/stock/entries \
     -H "Content-Type: application/json" \
     -d '{
       "entry_date": "2025-11-24",
       "entry_type": "Material Receipt",
       "to_warehouse_id": 1,
       "items": [{
         "item_code": "ITEM-001",
         "qty": 10,
         "valuation_rate": 100,
         "uom": "Kg"
       }]
     }'
   ```

3. **Verify Stock Balance**:
   ```sql
   SELECT * FROM stock_balance 
   WHERE item_code = 'ITEM-001' AND warehouse_id = 1;
   ```

## Summary

All issues have been resolved. The stock entry creation system now works correctly with the existing database schema. The backend no longer attempts to use non-existent `id` columns, and the frontend properly handles all data types and field names.
