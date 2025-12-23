# Sales Order Amount Fixes - Dec 23, 2025

## Problem Fixed
Sales Order items had Rate = 0.00 and Amount = 0.00, even though BOM materials had correct rates. This caused:
- Sales Order items to show zero amounts
- Analytics to show ₹0.00 (no sales data)

## Root Cause
The code was trying to use `bom.standard_selling_rate` or `bom.total_cost` fields that didn't exist in the BOM response.

## Solution Implemented

### 1. **Calculate BOM Total Cost from Materials** ✅
**File**: `frontend/src/pages/Selling/SalesOrderForm.jsx`
**Function**: `populateBOMItems()`

**What it does**:
- When BOM is selected, the function now:
  1. Extracts all materials from the BOM
  2. Calculates: `Total Cost = Σ(material.qty × material.rate)`
  3. Uses this calculated cost as the Sales Order item **rate**
  4. Sets SO item amount = qty × total_cost
  5. Updates form `order_amount` field

**Before**:
```javascript
rate: bom.standard_selling_rate || bom.total_cost || 0  // Always 0
```

**After**:
```javascript
let bomTotalCost = bom.materials.reduce((sum, material) => {
  const qty = parseFloat(material.qty) || 0
  const rate = parseFloat(material.rate) || 0
  return sum + (qty * rate)
}, 0)

const bomItem = {
  item_code: bom.item_code || bom.bom_id,
  item_name: bom.product_name || bom.description || bom.item_code || 'BOM Item',
  qty: quantity,
  rate: bomTotalCost,  // ✓ Now has the calculated cost
  amount: quantity * bomTotalCost,  // ✓ Correct amount
}
```

### 2. **Update Amount When Quantity Changes** ✅
**Function**: `handleChange()`

**What it does**:
- When user changes quantity field:
  1. Updates all SO items qty to the new quantity
  2. Recalculates: `amount = qty × rate` for each item
  3. Recalculates: `order_amount = Σ all item amounts`

### 3. **Update Amount on Item Changes** ✅
**Function**: `handleItemChange()`

**What it does**:
- When user changes item rate or qty:
  1. Recalculates: `amount = qty × rate`
  2. Recalculates: `order_amount = Σ all item amounts`

### 4. **Update Amount on Item Add/Remove** ✅
**Functions**: `handleAddItem()`, `handleRemoveItem()`

**What it does**:
- Recalculates `order_amount` whenever items are added or removed

## Expected Results After Fix

### Before Fix:
```
Sales Order Items Tab:
├─ RM-AL-PROFILE-001  Qty: 1  Rate: ₹0.00   Amount: ₹0.00
├─ FG-AL-WINDOW-001   Qty: 1  Rate: ₹0.00   Amount: ₹0.00
├─ RM-RUBBER-SEAL-001 Qty: 1  Rate: ₹0.00   Amount: ₹0.00
└─ ITEM-GEARBOXSUB    Qty: 1  Rate: ₹0.00   Amount: ₹0.00
Subtotal: ₹0.00

Analytics:
├─ Total Orders: 1
├─ Total Sales Amount: ₹0.00
└─ Avg Order Value: ₹0.00
```

### After Fix:
```
Sales Order Items Tab:
├─ RM-AL-PROFILE-001  Qty: 1  Rate: ₹315.00  Amount: ₹315.00
├─ FG-AL-WINDOW-001   Qty: 1  Rate: ₹315.00  Amount: ₹315.00
├─ RM-RUBBER-SEAL-001 Qty: 1  Rate: ₹315.00  Amount: ₹315.00
└─ ITEM-GEARBOXSUB    Qty: 1  Rate: ₹315.00  Amount: ₹315.00
Subtotal: ₹315.00

Analytics:
├─ Total Orders: 1
├─ Total Sales Amount: ₹315.00
└─ Avg Order Value: ₹315.00
```

## How It Works Step-by-Step

### Scenario: Create New Sales Order with BOM

1. **User selects BOM**: "BOM-STD-ALUM-FRAME-001"
   - Backend returns BOM with materials:
     ```
     materials: [
       { item_code: "RM-AL-PROFILE-001", qty: 1, rate: 250 },
       { item_code: "FG-AL-WINDOW-001", qty: 1, rate: 1 },
       { item_code: "RM-RUBBER-SEAL-001", qty: 1, rate: 34 },
       { item_code: "ITEM-GEARBOXSUB", qty: 1, rate: 30 }
     ]
     ```

2. **Frontend calculates BOM total**:
   ```
   BOM Total = (1×250) + (1×1) + (1×34) + (1×30) = ₹315
   ```

3. **SO Item is populated**:
   ```
   item_code: "BOM-STD-ALUM-FRAME-001"
   qty: 1
   rate: ₹315 (BOM cost)
   amount: ₹315 (qty × rate)
   ```

4. **Form shows**:
   ```
   Items Tab:
   Item: BOM-STD-ALUM-FRAME-001  Qty: 1  Rate: ₹315  Amount: ₹315
   Subtotal: ₹315
   ```

5. **User changes quantity to 2**:
   ```
   Form updates:
   qty: 2
   amount: 2 × ₹315 = ₹630
   order_amount: ₹630
   ```

6. **Analytics now shows**:
   ```
   Total Orders: 1
   Total Sales Amount: ₹630
   Avg Order Value: ₹630
   ```

## Testing Checklist

- [ ] Create new SO with BOM
- [ ] Verify SO item rate = BOM total cost
- [ ] Verify SO item amount = qty × rate
- [ ] Change quantity and verify amount updates
- [ ] Add manual item and verify order_amount recalculates
- [ ] Remove item and verify order_amount recalculates
- [ ] Submit SO and verify amount is saved
- [ ] Check Analytics shows correct sales amount

## Files Modified

1. **frontend/src/pages/Selling/SalesOrderForm.jsx**
   - Modified: `populateBOMItems()` - Calculate BOM total from materials
   - Modified: `handleChange()` - Update amounts on quantity change
   - Modified: `handleItemChange()` - Update order_amount on item changes
   - Modified: `handleAddItem()` - Update order_amount on item add
   - Modified: `handleRemoveItem()` - Update order_amount on item remove

## Related Issues Fixed

1. ✅ SO rate not populated from BOM cost
2. ✅ SO amount showing ₹0.00
3. ✅ Analytics showing ₹0.00 sales amount
4. ✅ Order amount not updating on qty change
5. ✅ Order amount not updating on item modification

## Next: Backend Validation (Optional)

To enforce that SO rate >= BOM cost, add backend validation:

**File**: `backend/src/routes/selling.js` (or similar)

```javascript
// Validate SO rate >= BOM cost
if (bomCost && soRate < bomCost) {
  return res.status(400).json({
    error: 'Sales rate cannot be less than BOM cost',
    bomCost,
    providedRate: soRate
  })
}
```

## Version Control

- **Date**: December 23, 2025
- **Developer**: Zencoder
- **Status**: Ready for Testing
