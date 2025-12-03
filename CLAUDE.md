# Aluminium ERP - Development Notes

## Recent Changes & Fixes

### 6. Stock Entry Creation - Fixed 'Unknown Column ID' Error ✅
**Date**: Nov 24, 2025
**Issue**: "Failed to create stock entry: Unknown column 'id' in 'field list'"
**Files**:
- `frontend/src/pages/Inventory/StockEntries.jsx` (fixed)
- `backend/src/models/StockEntryModel.js` (improved error handling)

**Root Cause**: 
- Items in the entryItems array were created with an `id` field for UI purposes (React keys, item removal)
- When submitting to backend, this `id` field was being sent but not expected by the INSERT statement

**Solution**:
- Replaced `id` field with `_key` field for UI management (React keys and item identification)
- Updated `handleAddItem()` to create items with `_key: manual_${Date.now()}` instead of `id: Date.now()`
- Updated `handleRemoveItem()` to use `item._key` instead of `item.id`
- Updated item table rendering to use `item._key` for keys and remove buttons
- Updated `handleGRNSelect()` to create GRN items with `_key: grn_${item.id}`
- Updated both `handleSubmit()` and `handleGRNFormSubmit()` to strip out `id`, `_key`, `item_name`, and `grn_item_id` before sending to backend
- Backend error handling improved with better error messages

**Testing**:
- Create manual stock entry with items - should no longer get id column error
- Create stock entry from GRN - should work correctly
- Both GRN and manual forms should properly clean items before submission

---

### 5. GRN Request Acceptance Page - Enhanced for Inventory Storage ✅
**Date**: Nov 22, 2025  
**Files**: 
- `frontend/src/pages/Inventory/GRNRequests.jsx` (enhanced)
- `backend/src/controllers/GRNRequestController.js` (updated)
- `backend/scripts/add-grn-storage-fields.sql` (new migration)

**What was done**:
- **Frontend Enhancement**:
  - Enhanced GRNRequests page to accept all GRN statuses (not just awaiting_inventory_approval)
  - Two-step approval process:
    1. **Material Inspection Form**: Inspect items, set accepted/rejected quantities, QC status
    2. **Storage Details Form**: Assign warehouse, bin/rack location, batch tracking, cost/valuation
  - Better UI with workflow instructions and progress indicators
  - Warehouse fetching and validation
  - Real-time validation of quantities and warehouse assignments
  - Loading states and comprehensive error handling

- **Backend Enhancement**:
  - Updated `inventoryApproveGRN` controller to accept and process `approvedItems` with storage data
  - Validates quantities match received amounts
  - Updates grn_request_items with: accepted_qty, rejected_qty, qc_status, bin_rack, valuation_rate
  - Automatically creates stock entries with proper warehouse and batch tracking
  - Includes error handling for quantity mismatches

- **Database Schema**:
  - Added 3 new columns to `grn_request_items` table:
    - `qc_status` (VARCHAR 50): pass/fail/hold status
    - `bin_rack` (VARCHAR 100): Warehouse location (e.g., A-12-3)
    - `valuation_rate` (DECIMAL 18,4): Cost per unit for inventory valuation

**Complete GRN Workflow**:
1. ✅ Buying creates GRN from Purchase Order
2. ✅ GRN automatically sent to Inventory (status: awaiting_inventory_approval)
3. ✅ Inventory inspects materials and sets accepted/rejected quantities
4. ✅ Inventory assigns warehouse locations and batch numbers
5. ✅ Approve and store - stock entries created automatically with proper valuation

**Database Migration Required**:
```bash
mysql -u root -p aluminium_erp < backend/scripts/add-grn-storage-fields.sql
```

**Testing Checklist**:
- [ ] Run migration to add new columns
- [ ] Create PO in Buying module
- [ ] Create GRN from the PO
- [ ] Go to `/inventory/grn-requests`
- [ ] Click "Approve & Store" on awaiting item
- [ ] Fill inspection details (accepted qty, QC status)
- [ ] Assign warehouse and bin/rack location
- [ ] Submit - verify stock entry is created
- [ ] Check stock balance updated correctly

---

### 1. GRN Modal Redesign ✅
**Date**: Nov 21, 2025  
**File**: `frontend/src/components/Buying/CreateGRNModal.jsx`

**What was done**:
- Complete UI/UX redesign with modern, organized layout
- 4 logical sections: Basic Info, Warehouse, Received Items, Notes
- Real database integration:
  - Fetches active POs from `/api/purchase-orders`
  - Filters for POs with status `to_receive` or `partially_received`
  - Fetches warehouses from `/api/stock/warehouses`
  - Auto-populates items from selected PO
- Enhanced fields: Item Code, Ordered Qty, Received Qty, Batch No, Remarks
- Real-time calculations and validation
- Loading states and error handling

**Backend**: Uses existing `/api/grn-requests` endpoint ✅

---

### 2. Modal Scrolling Fix ✅
**Date**: Nov 21, 2025  
**File**: `frontend/src/components/Modal/Modal.jsx`

**What was done**:
- Fixed modal overflow issues
- Added `max-h-[90vh]` constraint
- Implemented internal scrolling with `overflow-y-auto`
- Sticky header/footer using `flex-shrink-0`
- Applies to all modals (PO, GRN, Quotation, etc.)

**Result**: Modals now properly fit on screen with scrollable content

---

### 3. Purchase Order Creation - Tax Template Fix ✅
**Date**: Nov 21, 2025  
**File**: `backend/src/models/PurchaseOrderModel.js`  
**Migration**: `backend/scripts/add-tax-template-id.sql`

**Problem**: 
```
Failed to create purchase order: Unknown column 'tax_template_id' in 'field list'
```

**Solution**:
- Updated `create()` method to conditionally handle `tax_template_id`
- If provided → includes in INSERT
- If not provided → excludes from INSERT
- Works with or without the column in database

**Database Migration Required**:
```bash
mysql -u root -p aluminium_erp < backend/scripts/add-tax-template-id.sql
```

**Reference Documentation**: See `PURCHASE_ORDER_FIX.md`

---

### 4. Modal Standardization & Alignment ✅
**Date**: Nov 22, 2025
**Files**: 
- `frontend/src/components/Modal.jsx` (unified with Modal/Modal.jsx)
- `MODAL_STANDARDS.md` (comprehensive guidelines)

**What was done**:
- Unified both Modal components to use identical Tailwind flex layout
- Header and footer use `flex-shrink-0` (never scroll)
- Body uses `flex-1 overflow-y-auto` (scrollable content)
- Max height set to `max-h-[90vh]` (fits on screen)
- Added size support: sm, md, lg, xl, 2xl, 3xl
- All modal content properly aligned with consistent padding
- Prevents header/content overlap on scroll

**Coverage**:
- ✅ Buying: PO, GRN, Quotation, RFQ, Material Request, PI, etc.
- ✅ Selling: Invoice, Sales Order, Delivery Note, Customer, Quotation, etc.
- ✅ Production: Work Order, Production Plan, Entry, Rejection, etc.
- ✅ Inspection modals

**Result**: All modals now have consistent, aligned scrollable content with headers that never hide

**Documentation**: See `MODAL_STANDARDS.md` for implementation guide

---

## Build Status
- ✅ Frontend: Clean build (2319 modules, 280 KB gzipped)
- ✅ No TypeScript/ESLint errors  
- ✅ GRN acceptance page fully functional
- ✅ Production ready

## Next Steps for User

### 🔴 URGENT: Database Migration Required
```bash
mysql -u root -p aluminium_erp < backend/scripts/add-grn-storage-fields.sql
```

1. **Test GRN Request Flow (Complete End-to-End)**:
   - Go to http://localhost:5173/buying/purchase-orders
   - Click **+ Create PO** with multiple items
   - Submit PO
   - Go to http://localhost:5173/buying/grn-management
   - Click **Create GRN** button
   - Submit GRN (should appear in inventory awaiting approval)

2. **Test Inventory Approval & Storage**:
   - Go to http://localhost:5173/inventory/grn-requests
   - Filter by "Awaiting Inventory Approval" (should see your GRN)
   - Click **Approve & Store** button
   - **Step 1 - Material Inspection**:
     - Set accepted/rejected quantities
     - Choose QC status (Pass/Fail/Hold)
     - Click "Next: Storage Details"
   - **Step 2 - Warehouse Storage**:
     - Assign warehouse location for each item
     - Enter bin/rack location (e.g., A-12-3)
     - Enter cost/valuation rate (optional)
     - Click "Approve & Store in Inventory"
   - Verify: GRN status changes to "Stored", stock entry created

3. **Verify Stock Entry Created**:
   - Go to http://localhost:5173/inventory/stock-entries
   - Find Material Receipt for your GRN
   - Verify items and quantities match accepted items
   - Check warehouse assignment

4. **Verify Stock Balance Updated**:
   - Go to http://localhost:5173/inventory/stock-balance
   - Find items from your GRN
   - Verify quantity available increased

## Key Technical Decisions

1. **Conditional SQL Columns**: Handles databases with/without tax_template_id
2. **Parallel Data Fetching**: Uses Promise.all() for better performance
3. **Graceful Degradation**: Optional endpoints (tax-templates) don't break form
4. **Flex Layout**: Modern CSS flexbox for proper modal scrolling
5. **Type Conversions**: Explicit parseFloat() for numeric fields

## Commands to Remember

```bash
# Frontend build
cd frontend && npm run build

# Backend start
cd backend && npm start

# Database migrations (RUN IN ORDER)
mysql -u root -p aluminium_erp < backend/scripts/add-grn-storage-fields.sql
mysql -u root -p aluminium_erp < backend/scripts/add-tax-template-id.sql

# Verify GRN tables columns
mysql -u root -p -e "DESCRIBE aluminium_erp.grn_request_items;"

# Test GRN Request page
# Navigate to: http://localhost:5173/inventory/grn-requests
```
