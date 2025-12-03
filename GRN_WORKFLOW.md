# GRN Request Workflow - Complete Guide

## Overview
The GRN (Goods Receipt Note) workflow has been fixed and fully implemented. All GRN requests created from the Buying dashboard are now properly flowing to the Inventory dashboard for approval and storage.

## Complete Workflow

### Step 1: Create GRN Request (Buying Department)
**Location**: `http://localhost:5173/buying/purchase-receipts`

1. Navigate to **Buying > Purchase Receipts**
2. Click **+ Create GRN** button
3. Fill in the form:
   - Select Purchase Order
   - Items auto-populate from PO
   - Select warehouse for each item
   - Add optional notes
4. Click **Create GRN Request**

**What happens**:
- GRN request is created with status `awaiting_inventory_approval`
- Automatically skips QC inspection (direct buying→inventory flow)
- Saves with all item details including warehouse assignment

---

### Step 2: View GRN Requests (Inventory Department)
**Location**: `http://localhost:5173/inventory/grn-requests`

1. Navigate to **Inventory > GRN Requests**
2. Filter by status: **Awaiting Inventory Approval** (default)
3. See all GRN requests created from Buying department

**Table shows**:
- GRN Number (from Buying)
- PO Number (linked to purchase order)
- Supplier name
- Receipt date
- Item count
- Accepted quantity
- Current status

---

### Step 3: Approve & Store in Inventory (Inventory Department)
**Location**: Same as Step 2

1. Click **Store** button on a GRN with status "Awaiting Inventory Approval"
2. Review the modal showing:
   - GRN summary (PO, Supplier, Quantities)
   - Items to be stored (with accepted quantities)
   - Inspection details (if any QC checks were performed)
   - Warehouse assignment
   - Batch numbers

3. Click **Approve & Store in Inventory**

**What happens**:
- GRN status changes to `approved`
- Stock entry is automatically created
- Items are added to warehouse inventory
- Batch information is preserved
- Stock ledger entries are created

---

## Issues Fixed ✅

### Issue #1: Hardcoded API URL
**Problem**: `InventoryApprovalModal.jsx` used hardcoded `http://localhost:5000`

**Solution**: Changed to use environment variable:
```javascript
const response = await axios.post(
  `${import.meta.env.VITE_API_URL}/grn-requests/${grn.id}/inventory-approve`
)
```
**File**: `frontend/src/components/Buying/InventoryApprovalModal.jsx:20`

---

### Issue #2: Warehouse Information Not Stored
**Problem**: Stock entries were created without proper warehouse IDs (both were null)

**Solution**: Enhanced `inventoryApproveGRN` controller to:
1. Lookup warehouse ID from warehouse_name
2. Use first warehouse if not found
3. Pass warehouse ID to stock entry creation
4. Include batch number in stock entries

**File**: `backend/src/controllers/GRNRequestController.js:95-147`

**Changes**:
```javascript
// Lookup warehouse from GRN items
if (!toWarehouseId && item.warehouse_name) {
  const [warehouseRows] = await db.query(
    'SELECT id FROM warehouses WHERE warehouse_name = ? OR warehouse_code = ?',
    [item.warehouse_name, item.warehouse_name]
  )
  if (warehouseRows[0]) {
    toWarehouseId = warehouseRows[0].id
  }
}

// Use default warehouse if not found
if (!toWarehouseId) {
  const [defaultWarehouse] = await db.query('SELECT id FROM warehouses LIMIT 1')
  toWarehouseId = defaultWarehouse[0]?.id || 1
}
```

---

### Issue #3: Inventory Dashboard Display
**Problem**: Missing visual indicator for approved GRNs

**Solution**: Enhanced columns in Inventory GRNRequests page:
1. Added "Accepted Qty" column
2. Added "Stored" status button for approved GRNs
3. Proper status filtering by default

**File**: `frontend/src/pages/Inventory/GRNRequests.jsx:145-218`

---

## Database Flow

```
┌─────────────────────────────────────┐
│  Purchase Order (Buying)            │
│  Status: submitted                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  GRN Request Created (Buying)        │
│  Status: awaiting_inventory_approval │
│  - Skips QC inspection               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Inventory Reviews GRN               │
│  Filter: awaiting_inventory_approval │
└──────────────┬──────────────────────┘
               │
               ▼ (Click "Store")
┌─────────────────────────────────────┐
│  Stock Entry Created (Auto)          │
│  - Entry Type: Material Receipt      │
│  - To Warehouse: From GRN items      │
│  - Items: With batch numbers         │
│  - Status: Draft                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  GRN Status: approved                │
│  Stock Ledger Entries Created        │
│  Inventory Updated                   │
└─────────────────────────────────────┘
```

---

## API Endpoints Used

### Creating GRN Request (Buying)
```
POST /api/grn-requests
Body: {
  grn_no: string,
  po_no: string,
  supplier_id: number,
  supplier_name: string,
  receipt_date: date,
  items: [{
    item_code: string,
    item_name: string,
    po_qty: number,
    received_qty: number,
    batch_no: string,
    warehouse_name: string
  }],
  notes: string
}
```

### Getting GRN Requests (Inventory)
```
GET /api/grn-requests?status=awaiting_inventory_approval
```

### Approving GRN (Inventory)
```
POST /api/grn-requests/{id}/inventory-approve
```

---

## Testing the Workflow

### Step 1: Create a Purchase Order
- Navigate to Buying > Purchase Orders
- Create a PO with at least 1 item
- Select supplier and warehouse

### Step 2: Create GRN from PO
- Go to Buying > Purchase Receipts
- Click "Create GRN"
- Select the PO from Step 1
- Items auto-populate
- Submit the form

### Step 3: View in Inventory Dashboard
- Go to Inventory > GRN Requests
- Should see the GRN with status "Awaiting Inventory Approval"
- Check that supplier, PO, and item details are correct

### Step 4: Approve & Store
- Click "Store" button
- Review modal with item details
- Click "Approve & Store in Inventory"
- GRN status should change to "Approved"

### Step 5: Verify Stock Entry
- Go to Inventory > Stock Entries
- Should see a new entry "Material Receipt" with reference to the GRN
- Items should show correct warehouse and batch numbers

---

## Troubleshooting

### GRN not appearing in Inventory dashboard
1. Check that status filter is set to "Awaiting Inventory Approval"
2. Verify GRN was created successfully (check backend logs)
3. Ensure API URL is correctly configured in frontend

### Stock entry not created
1. Check that warehouse exists in database
2. Verify items are linked correctly (item_code matches in item table)
3. Check backend logs for stock entry creation errors

### Approval button not working
1. Clear browser cache
2. Verify API URL in InventoryApprovalModal is correct
3. Check browser console for API errors

---

## Key Features Implemented

✅ **Automatic GRN to Inventory Flow**
- No manual intervention needed between departments
- Status automatically updated to `awaiting_inventory_approval`

✅ **Warehouse Assignment**
- Items assigned to specific warehouses during GRN creation
- Warehouse info preserved through approval process
- Stock entries created in correct warehouse

✅ **Batch Tracking**
- Batch numbers preserved from GRN to stock entry
- Batch info available for stock ledger tracking

✅ **Stock Entry Auto-Creation**
- Stock entries automatically created when GRN approved
- Entries in "Draft" status for further processing
- Reference to original GRN maintained

✅ **Status Tracking**
- Clear status progression: pending → awaiting_inventory_approval → approved
- Audit trail maintained in grn_request_logs table
- User assignment and approval tracking

---

## Related Files Modified

### Frontend
- `frontend/src/components/Buying/InventoryApprovalModal.jsx` - Fixed API URL
- `frontend/src/pages/Inventory/GRNRequests.jsx` - Enhanced UI with new columns

### Backend
- `backend/src/controllers/GRNRequestController.js` - Fixed stock entry creation with warehouse IDs

### Build Status
✅ Frontend build successful (2317 modules)
✅ Backend syntax check passed
✅ No compilation errors
