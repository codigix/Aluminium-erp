# BOM Total Cost Calculation Fix

## Issue Resolved
BOMs were displaying `total_cost: "0.00"` in the API response despite having valid materials with rates. The issue was:
1. The `item` table was missing `valuation_rate` and `standard_selling_rate` columns as fallbacks
2. The `getBOMs()` and `getBOMDetails()` methods weren't properly calculating costs when `bom_line.rate` was 0

## Changes Made

### 1. Database Schema (✅ Already Had Columns)
- Verified `item` table has `valuation_rate` and `standard_selling_rate` columns
- Added indexes for performance

### 2. ProductionModel.js - Updated getBOMs() (Line 649-697)
- Enhanced cost calculation logic to:
  - Use `bom_line.rate` first (primary source)
  - Fall back to `item.valuation_rate` if rate is 0
  - Fall back to `item.standard_selling_rate` if valuation_rate is also 0
  - Convert all costs to proper decimal format

### 3. ProductionModel.js - Updated getBOMDetails() (Line 703-738)
- Applied same cost calculation enhancement
- Now properly recalculates total_cost from materials when stored value is 0

### 4. SellingController.js - Updated getBOMList() (Line 1285-1325)
- Recalculates total_cost for BOMs with 0 cost
- Uses same three-tier fallback logic
- Returns accurate costs in BOM list endpoint

### 5. SellingController.js - Updated getBOMDetails() (Line 1338-1359)
- Enhanced materials mapping to use `bom_line.rate`
- Recalculates total_cost on-the-fly if missing
- Ensures frontend receives correct cost values

## How It Works Now

When fetching BOMs, the system calculates total_cost as:

```
For each material in BOM:
  quantity = material.quantity
  rate = material.rate (from bom_line)
  if rate is 0:
    rate = item.valuation_rate (from item master)
  if rate is still 0:
    rate = item.standard_selling_rate (from item master)
  
  total_cost += quantity × rate
```

## Testing the Fix

After restarting the backend with `npm run backend`, test with:

```bash
# Get all BOMs (should show correct total_cost instead of 0.00)
curl http://localhost:5000/api/selling/boms

# Get specific BOM details
curl http://localhost:5000/api/selling/bom/BOM-1766487750453

# Response should now include total_cost calculated from materials
```

## Expected Results

BOMs that previously showed:
```json
{
  "bom_id": "BOM-1766487750453",
  "total_cost": "0.00",
  ...
}
```

Will now show calculated costs based on:
1. Stored `bom_line.rate` values (if provided during BOM creation)
2. Item master `valuation_rate` (backup)
3. Item master `standard_selling_rate` (final fallback)

## Notes

- The fix ensures backward compatibility - BOMs with pre-calculated costs remain unchanged
- BOMs created without rates in bom_line will use item master pricing
- All cost values are formatted to 2 decimal places for consistency

---

## Phase 12: Operations Cost Inclusion in BOM Total Cost

### Issue Identified
BOM total_cost was only including **Material Cost**, missing **Operations Cost** which led to incomplete costing:
- Material Cost: ₹377
- Operations Cost: ₹90
- **Incorrect Total**: ₹377 (missing operations)
- **Correct Total**: ₹467 (material + operations)

### Root Cause
All four BOM cost calculation methods were only summing material line costs. The operations were being fetched but not included in the total_cost calculation.

### Changes Made

#### 1. ProductionModel.js - getBOMs() (Lines 670-704)
**Before**: Only calculated material costs
**After**: 
- Fetches `bom_operation.operating_cost` for each BOM
- Calculates total = materialCost + operationCost
- Both costs summed before returning BOMs

#### 2. ProductionModel.js - getBOMDetails() (Lines 728-749)
**Before**: Calculated total_cost from materials only
**After**:
- Recalculates materialCost from lines (with three-tier fallback)
- Calculates operationCost from bom_operation records
- Returns total_cost = materialCost + operationCost

#### 3. SellingController.js - getBOMList() (Lines 1294-1326)
**Before**: Only included material costs in recalculation
**After**:
- Fetches operations for BOMs with zero cost
- Separates materialCost and operationCost calculation
- Combines both for accurate total_cost

#### 4. SellingController.js - getBOMDetails() (Lines 1380-1395)
**Before**: Only included material costs
**After**:
- Calculates materialCost from enhanced materials
- Calculates operationCost from operations array
- Returns bomData.total_cost = materialCost + operationCost

### Cost Calculation Formula
```
total_cost = ∑(material_qty × material_rate) + ∑(operation_operating_cost)

Where:
- material_qty = bom_line.quantity
- material_rate = bom_line.rate (with fallback to item.valuation_rate or standard_selling_rate)
- operation_operating_cost = bom_operation.operating_cost
```

### Impact
✅ BOM total costs now accurately reflect complete production costs
✅ Margin calculations will be correct (selling price - total_cost)
✅ Profitability analysis becomes reliable
✅ Cost comparison between BOMs includes all cost factors

---

## Phase 13: Scrap Items Persistence Fix

### Issues Fixed

#### Issue 1: Property Name Mismatch
**Problem**: SellingController returned `scrap_items` but frontend expected `scrapItems`
- When fetching BOM details via API, scrap items were missing in frontend
- Frontend code: `setScrapItems(bom.scrapItems || [])`
- Backend response had: `bomData.scrap_items`

**Solution**: SellingController.js `getBOMDetails()` (Line 1397-1400)
- Now returns both `scrapItems` and `scrap_items` for full compatibility
- Frontend receives correct property name

#### Issue 2: Empty Scrap Items Array Not Persisted
**Problem**: When updating BOM with empty scrapItems array, old items remained in database
- Code only deleted/saved if `scrapItems.length > 0`
- Empty array from frontend was ignored

**Solution**: ProductionController.js `updateBOM()` (Line 1140-1144)
- **Before**: `if (scrapItems && Array.isArray(scrapItems) && scrapItems.length > 0)`
- **After**: `if (scrapItems && Array.isArray(scrapItems))`
- Now always deletes existing items when array is provided
- Then adds new items if array has elements
- Empty array properly clears all scrap items

### Files Modified
- **SellingController.js** - Added `scrapItems` property alongside `scrap_items` (Line 1398)
- **ProductionController.js** - Fixed updateBOM to handle empty scrapItems array (Line 1140)

### Result
✅ Scrap items now properly persist when added
✅ Scrap items now properly delete when array is cleared
✅ Frontend correctly receives scrapItems from API
✅ No orphaned scrap items remain after BOM updates

---

## Phase 14: Sales Order List Display - Field Name Mapping Fix

### Issue Identified
Sales Order list showed invalid data:
- ORDER VALUE: ₹0.00 (should show BOM cost)
- QTY: 0 (should show order quantity)
- ORDER DATE: N/A

**Root Cause**:
Field name mismatch between frontend and backend:

| Data | Frontend Sends | Backend Expects | Result |
|------|---|---|---|
| Order Amount | `total_amount` | `order_amount` | Stored as 0 |
| Quantity | `qty` | `quantity` | Stored as 0 |

Frontend payload (SalesOrderForm.jsx):
```javascript
const payload = {
  qty: 1,
  total_amount: 377,
  ...
}
```

Backend expected (SellingController.js):
```javascript
const { order_amount, quantity } = req.body
```

### Solution Implemented

#### SellingController.js - createSalesOrder() (Lines 371, 374-375, 407)
- **Before**: Only accepted `order_amount`, `quantity`
- **After**: Now accepts both field name variations
  - `order_amount` OR `total_value` OR `total_amount`
  - `quantity` OR `qty`
  - Uses fallback chain: first available value is used
  - DEFAULT: `finalAmount = 0`, `finalQuantity = 1`

#### SellingController.js - updateSalesOrder() (Lines 579, 602-604, 622-624)
- **Before**: Only accepted `order_amount`, `quantity`
- **After**: Now accepts both naming conventions
  - Amount field check: `order_amount OR total_value OR total_amount`
  - Quantity field check: `quantity OR qty`
  - Properly updates database with correct values

### Impact
✅ Sales orders now display correct ORDER VALUE amounts
✅ Sales orders now display correct QTY values
✅ Both frontend field names (`qty`, `total_amount`) work
✅ Backward compatible with API field names (`quantity`, `order_amount`)
✅ Data persists correctly to database

---

## Phase 15: Sales Order Header Totals Recalculation (CRITICAL FIX)

### Issue Identified
Sales Order list displayed:
- ORDER VALUE: ₹0.00 (items exist with ₹377 total)
- QTY: 0 (items exist with qty > 0)
- ORDER DATE: N/A

**Root Cause** (Critical Bug):
After inserting `sales_order_items`, the `sales_orders` header record was NEVER updated with calculated totals.

**Example**:
```
sales_order_items table:
- Item 1: qty=1, rate=127 → amount=127
- Item 2: qty=1, rate=250 → amount=250
- TOTAL: 377

selling_sales_order table (header):
- order_amount: 0.00 ❌ (should be 377)
- quantity: 0 ❌ (should be 2)
- total_value: 0.00 ❌
```

### Solution Implemented

#### SellingController.js - createSalesOrder() (Lines 411-429, 431-452)

**Before**: Items inserted, header never updated
```javascript
if (items.length > 0) {
  for (const item of items) {
    INSERT INTO sales_order_items
  }
}
// ❌ ORDER HEADER STILL HAS 0.00
```

**After**: Calculate and update header after items inserted
```javascript
if (items && Array.isArray(items) && items.length > 0) {
  let totalAmount = 0
  let totalQty = 0
  for (const item of items) {
    const qty = parseFloat(item.qty || 1)
    const rate = parseFloat(item.rate || 0)
    totalAmount += (qty * rate)  // ✅ Running sum
    totalQty += qty
    INSERT INTO sales_order_items
  }
  // ✅ UPDATE header with calculated totals
  UPDATE selling_sales_order SET 
    order_amount = totalAmount,
    quantity = totalQty
}
```

#### SellingController.js - updateSalesOrder() (Lines 657-684)

Applied identical fix:
- Delete old items
- Insert new items
- Recalculate totals
- Update header with calculated values
- If no items: set order_amount and quantity to 0

### Cost Calculation Logic
```javascript
For each item in sales_order_items:
  item_qty = parseFloat(qty)
  item_rate = parseFloat(rate)
  item_amount = item_qty × item_rate
  
total_amount = ∑(item_amount)
total_qty = ∑(item_qty)

Then UPDATE sales_orders SET:
  order_amount = total_amount
  quantity = total_qty
```

### Result
✅ Sales Order list now shows correct ORDER VALUE (₹377+)
✅ Sales Order list now shows correct QTY (2, 3, etc.)
✅ Header totals always match sum of items
✅ Works for both create and update operations
✅ Handles empty items list (sets to 0)

### Verification Steps
1. Create new Sales Order with 2 items
2. Open Sales Orders list
3. Expected: ORDER VALUE shows ₹377, QTY shows 2
4. Edit order to change items
5. Expected: Totals update immediately

### Related Data Flow
```
Frontend (SalesOrderForm.jsx)
  → sends: items array with qty + rate
  ↓
SellingController.createSalesOrder()
  → validates items
  → inserts sales_order header (with initial order_amount)
  → inserts sales_order_items (one per item)
  → ✅ RECALCULATES order_amount from items
  → ✅ UPDATES sales_orders header
  ↓
Database (selling_sales_order, sales_order_items)
  → header now has correct total_amount
  ↓
SalesOrder.jsx list page
  → queries header totals
  → displays ✅ correct values
```
