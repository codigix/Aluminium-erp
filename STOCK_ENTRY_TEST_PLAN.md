# Stock Entry Creation Flow - Test Plan

## Overview
This document outlines the comprehensive testing procedures to verify that the stock entry creation flow works correctly after the database schema fixes implemented in the previous session.

## Test Objectives
1. Verify stock entry creation from GRN requests
2. Verify manual stock entry creation
3. Verify automatic submission of stock entries
4. Verify stock balance updates after stock entry submission
5. Verify database schema compatibility (both old and new schemas)

---

## Part 1: Test Environment Setup

### Prerequisites
- Backend server running on `http://localhost:3000`
- Frontend server running on `http://localhost:5173`
- MySQL database with the migration applied (or ready for fallback handling)
- User with 'inventory' department access for testing

### Required Test Data
- At least one warehouse in the system
- At least one supplier
- At least one item (with item_code)
- At least one approved GRN request with accepted items

---

## Part 2: Manual Testing Procedures

### Test Case 1: Create Stock Entry from GRN Request (Most Common Workflow)

**Steps:**
1. Log in as Inventory department user
2. Navigate to Inventory Module → Stock Entries
3. Click "Manual Entry" button
4. In the modal, select a GRN from the dropdown (e.g., "GRN-001 - Supplier Name (3 items)")
5. Verify that:
   - GRN details display (GRN number, PO number, supplier name)
   - Entry date is auto-filled
   - Entry type is set to "Material Receipt"
   - Items are auto-populated with:
     - item_code (correct value)
     - qty (from GRN accepted quantity)
     - valuation_rate (if available)
     - batch_no (if present in GRN)
   - To Warehouse field is visible and required
6. Select a "To Warehouse" value
7. (Optional) Update remarks or other fields
8. Click "Create Entry" button

**Expected Results:**
- Stock entry should be created successfully (201 response)
- Stock entry should be auto-submitted (submitted_at timestamp set)
- Success message: "Stock entry created successfully"
- Stock entry should appear in the Stock Entries list
- Stock balance should be updated with the received items

**Failure Indicators:**
- 500 error with "Unknown column 'id'" or "Unknown column 'item_code'"
- Stock entry created but not submitted
- Stock balance not updated
- Items not properly displayed in the form

---

### Test Case 2: Create Manual Stock Entry (No GRN)

**Steps:**
1. Log in as Inventory department user
2. Navigate to Inventory Module → Stock Entries
3. Click "Manual Entry" button
4. Leave GRN dropdown as "-- Manual Entry --"
5. Fill in the form:
   - Entry Date: Today's date
   - Entry Type: "Material Receipt"
   - To Warehouse: Select a warehouse
   - Remarks: Optional
6. In the "Add Items" section:
   - Select an item_code from dropdown
   - Enter quantity (e.g., 10)
   - Enter valuation rate (e.g., 100)
   - Optionally add batch number
   - Click add item button
7. Repeat step 6 for multiple items if desired
8. Click "Create Entry" button

**Expected Results:**
- Stock entry created successfully
- Stock entry submitted automatically
- Stock balance updated with new quantities

---

### Test Case 3: Verify Database Column Compatibility

**Purpose:** Verify that the backend handles both old (item_id) and new (item_code) database schemas

**Steps:**
1. Check the current database schema:
   ```sql
   DESCRIBE stock_entry_items;
   ```
   
2. If `item_code` column exists:
   - This means the migration has been applied
   - Stock entry creation should use item_code path
   
3. If only `item_id` column exists:
   - This means the migration hasn't been applied yet
   - Backend should fall back to item_id path
   - Stock entry creation should still work with fallback logic

**Expected Results:**
- Stock entries should be created successfully regardless of which schema is active
- The defensive try-catch blocks in StockEntryModel should handle the schema variation

---

## Part 3: API Testing

### Test 3.1: Create Stock Entry API Endpoint

**Endpoint:** `POST /api/stock/entries`

**Valid Request Payload (GRN-based):**
```json
{
  "entry_date": "2025-11-24",
  "entry_type": "Material Receipt",
  "from_warehouse_id": null,
  "to_warehouse_id": 1,
  "purpose": "GRN: GRN-001",
  "reference_doctype": "GRN",
  "reference_name": "GRN-001",
  "remarks": "Test GRN entry",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 10,
      "valuation_rate": 100,
      "uom": "Kg",
      "batch_no": "BATCH-001"
    }
  ]
}
```

**Expected Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "entry_no": "MR-001",
    "entry_date": "2025-11-24",
    "entry_type": "Material Receipt",
    "status": "Submitted",
    "items": [...],
    "total_qty": 10,
    "total_value": 1000
  },
  "message": "Stock entry created and submitted successfully. Items added to stock balance."
}
```

**Status Code:** `201 Created`

---

### Test 3.2: List Stock Entries API Endpoint

**Endpoint:** `GET /api/stock/entries`

**Expected Response:**
- Should return array of stock entries
- Each entry should have warehouse names, not just IDs
- Should be sorted by entry_date descending

---

### Test 3.3: Get Stock Entry by ID

**Endpoint:** `GET /api/stock/entries/:id`

**Expected Response:**
- Should return stock entry with complete details
- Items should include:
  - item_code
  - item_name (from item table)
  - qty, valuation_rate, uom
  - batch_no if present

---

## Part 4: Stock Balance Verification

After creating a stock entry, verify that stock balance is updated correctly.

### Stock Balance Check:

1. Navigate to Inventory Module → Stock Balance
2. Look for the item that was added in the stock entry
3. Verify:
   - Item code is correct
   - Warehouse matches the "To Warehouse" selected during entry
   - Quantity shows the sum of all entries for this item
   - Valuation rate is recorded

### Database Query Verification:

```sql
SELECT * FROM stock_balance 
WHERE item_code = 'ITEM-001' AND warehouse_id = 1;
```

**Expected Results:**
- Row exists for the item and warehouse
- quantity matches what was entered
- valuation_rate is set correctly

---

## Part 5: Error Scenarios

### Error Test 1: Missing Required Fields

**Request:**
```json
{
  "entry_date": "2025-11-24",
  "items": []
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Missing required fields"
}
```

**Status Code:** `400 Bad Request`

---

### Error Test 2: Missing Warehouse for Material Receipt

**Request:**
```json
{
  "entry_date": "2025-11-24",
  "entry_type": "Material Receipt",
  "purpose": "Test",
  "items": [{"item_code": "ITEM-001", "qty": 10}]
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Destination warehouse required for Material Receipt"
}
```

**Status Code:** `400 Bad Request`

---

### Error Test 3: Invalid Item Code

**Request:**
```json
{
  "entry_date": "2025-11-24",
  "entry_type": "Material Receipt",
  "to_warehouse_id": 1,
  "items": [{"item_code": "INVALID-CODE", "qty": 10}]
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Failed to create stock entry: Item not found with code: INVALID-CODE"
}
```

**Status Code:** `500 Internal Server Error`

---

## Part 6: Schema Migration Testing

### If Migration Has NOT Been Applied Yet:

1. Run the migration script:
   ```bash
   cd backend
   node scripts/run-migration.js
   ```

2. Verify migration was successful:
   ```sql
   DESCRIBE stock_entry_items;
   ```
   Should now show `item_code` column

3. Repeat Part 2 tests after migration

### If Migration Has Been Applied:

1. Verify schema looks correct:
   ```sql
   DESCRIBE stock_entry_items;
   ```

2. Verify no data loss by checking item count:
   ```sql
   SELECT COUNT(*) FROM stock_entry_items;
   ```

---

## Part 7: Performance Testing

### Test Large Stock Entry Creation

**Objective:** Ensure the system can handle stock entries with many items

1. Create a stock entry with 50+ items
2. Verify:
   - Response time < 5 seconds
   - All items are saved correctly
   - Transaction completes successfully (no partial inserts)

---

## Part 8: Integration Testing

### Test GRN to Stock Entry to Stock Balance Flow

**Complete Workflow:**
1. Create a Purchase Order
2. Create a GRN from the PO
3. Approve the GRN (QC inspection)
4. Create stock entry from GRN
5. Verify:
   - Stock entry is submitted
   - Stock balance is updated
   - Stock ledger has entries for the transaction

---

## Expected Success Criteria

✅ All manual testing procedures pass without errors  
✅ All API endpoints return correct status codes and response formats  
✅ Database queries return expected results  
✅ Stock balance reflects all additions from stock entries  
✅ System handles both old and new database schemas gracefully  
✅ No 500 errors related to "Unknown column" issues  
✅ Performance is acceptable (< 2 seconds per operation)  

---

## Troubleshooting Guide

### Issue: "Unknown column 'item_code'" Error

**Cause:** Database migration not applied

**Solution:**
1. Run the migration script: `node scripts/run-migration.js`
2. Or apply migration manually from `backend/scripts/fix-item-code-schema.sql`

### Issue: Stock Entry Created but Not Submitted

**Cause:** Possible error during auto-submit phase

**Solution:**
1. Check backend logs for error message
2. Check if stock_ledger table is accessible
3. Verify warehouse exists for the entry

### Issue: Stock Balance Not Updated

**Cause:** Stock ledger insert failed

**Solution:**
1. Check stock_ledger table structure
2. Verify item_code column exists in stock_ledger
3. Check for database constraints violations

---

## Testing Checklist

- [ ] Test Case 1: Create Stock Entry from GRN Request - PASSED
- [ ] Test Case 2: Create Manual Stock Entry - PASSED
- [ ] Test Case 3: Verify Database Column Compatibility - PASSED
- [ ] Test 3.1: Create Stock Entry API - PASSED
- [ ] Test 3.2: List Stock Entries API - PASSED
- [ ] Test 3.3: Get Stock Entry by ID - PASSED
- [ ] Part 4: Stock Balance Verification - PASSED
- [ ] Error Test 1: Missing Required Fields - PASSED
- [ ] Error Test 2: Missing Warehouse - PASSED
- [ ] Error Test 3: Invalid Item Code - PASSED
- [ ] Part 6: Schema Migration Testing - PASSED
- [ ] Part 7: Performance Testing - PASSED
- [ ] Part 8: Integration Testing - PASSED

---

## Test Summary

Once all tests pass, the stock entry creation flow can be considered validated and ready for production use.

For questions or issues, refer to MIGRATION.md for additional guidance on database setup and troubleshooting.
