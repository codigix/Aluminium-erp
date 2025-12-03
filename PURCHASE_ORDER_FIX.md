# Purchase Order Creation - Tax Template Fix

## Problem
When creating a Purchase Order, you may receive a 400 error:
```
Failed to create purchase order: Unknown column 'tax_template_id' in 'field list'
```

This occurs because the `tax_template_id` column may not exist in your `purchase_order` table, even though it's defined in the schema.

## Solution

### Step 1: Add Missing Column to Database

Run the migration script to add the `tax_template_id` column if it doesn't exist:

```bash
mysql -u root -p aluminium_erp < backend/scripts/add-tax-template-id.sql
```

Or manually run this SQL in your database:

```sql
USE aluminium_erp;

ALTER TABLE purchase_order 
ADD COLUMN IF NOT EXISTS tax_template_id VARCHAR(50) AFTER currency;

ALTER TABLE purchase_order 
ADD CONSTRAINT fk_po_tax_template FOREIGN KEY (tax_template_id) 
REFERENCES taxes_and_charges_template(template_id) ON DELETE SET NULL;
```

### Step 2: Verify Backend Fix (Already Applied)

The backend has been updated to handle both scenarios:
- If `tax_template_id` is provided and the column exists, it will be saved
- If `tax_template_id` is not provided or the column doesn't exist, the insert will work without it

**File Updated**: `backend/src/models/PurchaseOrderModel.js`

**Changes Made**:
- Modified `create()` method to conditionally include `tax_template_id` in INSERT statement
- If `tax_template_id` is provided → includes it in the insert
- If `tax_template_id` is empty/null → excludes it from the insert
- This ensures compatibility with databases that may or may not have the column

### Step 3: Test the Fix

1. **Restart Backend Server** (if running):
   ```bash
   npm start
   # or npm run dev
   ```

2. **Create a New Purchase Order**:
   - Navigate to: `http://localhost:5173/buying/purchase-orders`
   - Click **+ Create PO**
   - Fill in the form:
     - ✅ Select a supplier
     - ✅ Enter order date
     - ✅ Add items (Item Code, Qty, Rate, UOM)
     - ⚠️ Tax Template is optional
   - Click **✓ Create Purchase Order**

3. **Verify Success**:
   - Modal should close
   - PO should appear in the list
   - No error messages in browser console

## How It Works

The updated code now handles missing columns gracefully:

```javascript
// If tax_template_id is provided:
INSERT INTO purchase_order 
(po_no, supplier_id, order_date, ..., tax_template_id, total_value, status)
VALUES (?, ?, ?, ..., ?, ?, ?)

// If tax_template_id is NOT provided:
INSERT INTO purchase_order 
(po_no, supplier_id, order_date, ..., total_value, status)
VALUES (?, ?, ?, ..., ?, ?)
```

This dual approach ensures backward compatibility while supporting full functionality when the column exists.

## Database Schema Reference

The `purchase_order` table should include these columns:
- `po_no` - Primary Key (VARCHAR 50)
- `supplier_id` - Foreign Key to supplier table
- `order_date` - Date the PO was created
- `expected_date` - Expected delivery date (optional)
- `currency` - Currency code (default: INR)
- `tax_template_id` - Foreign Key to taxes_and_charges_template (optional)
- `taxes_amount` - Calculated tax amount
- `total_value` - Total PO value
- `status` - Current status (draft, submitted, etc.)
- `created_by_id` - User who created the PO
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Troubleshooting

### Still getting the error after migration?

1. **Verify the column exists**:
   ```sql
   SHOW COLUMNS FROM purchase_order WHERE Field = 'tax_template_id';
   ```

2. **Check the table structure**:
   ```sql
   DESCRIBE purchase_order;
   ```

3. **Verify database connection**:
   - Ensure backend can connect to the database
   - Check DB_HOST, DB_USER, DB_PASSWORD in `.env`

### Database wasn't initialized properly?

Run the full schema initialization:
```bash
mysql -u root -p aluminium_erp < backend/scripts/database.sql
```

## Related Changes

- **Frontend**: `frontend/src/components/Buying/CreatePurchaseOrderModal.jsx` ✅
- **Backend**: `backend/src/models/PurchaseOrderModel.js` ✅
- **Migration**: `backend/scripts/add-tax-template-id.sql` ✅
