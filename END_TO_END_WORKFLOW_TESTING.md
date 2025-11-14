# End-to-End Workflow Testing & Usage Guide

## 🎯 Complete Modal-Based Workflows

### **SELLING MODULE - Complete Flow (Sales Order → Delivery Note → Invoice)**

#### **Step 1: Create Sales Order** ✅
Location: `/selling/sales-orders`

```
1. Click [New Sales Order] Button → Opens CreateSalesOrderModal
2. Select Customer (e.g., "CUST-1234567890")
3. Enter Order Date (Auto-filled with today)
4. Select Quotation (Optional)
5. Enter Order Amount
6. Set Delivery Date
7. Add Order Terms & Conditions
8. Click [Create Sales Order] Button
9. List refreshes automatically with new order (Status: "draft")
```

**Form Fields:**
- Customer ID * (dropdown)
- Order Date * (date picker)
- Quotation ID (optional, dropdown)
- Order Amount * (currency)
- Delivery Date (date picker)
- Terms & Conditions (textarea)

**Backend:**
- `POST /api/selling/sales-orders`
- Creates record with `status = 'draft'`
- Returns: `sales_order_id, customer_id, customer_name`

---

#### **Step 2: View Sales Order Details** ✅
Location: `/selling/sales-orders` - Click [👁️ View] icon

```
1. Click [👁️ View] on any order → Opens ViewSalesOrderModal
2. See read-only details:
   - Order ID
   - Customer Name
   - Amount (formatted currency)
   - Delivery Date
   - Status (color-coded badge)
   - Quotation ID (if linked)
   - Terms & Conditions
   - Created Date/Time
3. Close modal with [X] or [Close] button
```

**Display Format:**
- All information read-only
- Currency formatted as ₹X,XXX.XX
- Dates formatted as DD/MM/YYYY
- Status shown with semantic color coding

**Backend:**
- `GET /api/selling/sales-orders/:id`
- Returns: Complete order with `customer_name` populated

---

#### **Step 3: Edit Sales Order & Change Status** ✅
Location: `/selling/sales-orders` - Click [✏️ Edit] icon (only for draft orders)

```
1. Click [✏️ Edit] on draft order → Opens EditSalesOrderModal
2. Can modify:
   - Order Amount
   - Delivery Date
   - Terms & Conditions
   - Status (dropdown with 5 options)
3. Status Options:
   - draft (default for new orders)
   - confirmed (ready to create delivery)
   - dispatched (goods in transit)
   - invoiced (invoice created)
   - cancelled (order cancelled)
4. Click [Update Sales Order] to save changes
5. List refreshes with updated status
```

**Typical Status Flow:**
```
draft 
  ↓
confirmed (create delivery note from this status)
  ↓
dispatched (create after delivery submitted)
  ↓
invoiced (create after invoice created)
  OR
cancelled (at any stage)
```

**Backend:**
- `PUT /api/selling/sales-orders/:id`
- Updates only provided fields (dynamic update)
- Returns: Updated order with `customer_name`

---

#### **Step 4: Create Delivery Note** ✅
Location: `/selling/delivery-notes` - Click [New Delivery Note] Button

```
1. Click [New Delivery Note] Button → Opens CreateDeliveryNoteModal
2. Select Sales Order (only shows CONFIRMED orders)
   - Customer name auto-populates
3. Enter Delivery Date
4. Enter Total Quantity
5. (Optional) Enter Driver Name
6. (Optional) Enter Vehicle Number
7. (Optional) Add Remarks
8. Click [Create Delivery Note] Button
9. List refreshes with new DN (Status: "draft")
```

**Key Points:**
- Only CONFIRMED Sales Orders available
- Auto-population: `customer_name` from selected order
- Quantity in units
- Status starts as "draft"

**Backend:**
- `POST /api/selling/delivery-notes`
- Backend joins: sales_order → customer
- Returns: Delivery note with customer info

---

#### **Step 5: Submit Delivery Note** ✅
Location: `/selling/delivery-notes`

```
1. For draft delivery notes, click [📤 Submit] button
2. Status changes from "draft" → "submitted"
   (or can navigate and edit status)
3. After submission, delivery note shows as "submitted"
4. Wait for status to change to "delivered" 
   (via admin action or API)
```

**Important:** 
- Only delivered delivery notes can be used for invoice creation
- Check backend for status update mechanism

---

#### **Step 6: Create Sales Invoice** ✅
Location: `/selling/sales-invoices` - Click [New Invoice] Button

```
1. Click [New Invoice] Button → Opens CreateInvoiceModal
2. Select Delivery Note (only DELIVERED ones show)
   - Customer name auto-populates
3. Invoice Date (auto-filled with today)
4. Enter Invoice Amount (₹)
5. Enter Due Date
6. Select Tax Rate (0%, 5%, 12%, 18%, 28%)
7. Select Invoice Type:
   - Standard (default)
   - Advance Payment
   - Credit
8. Click [Create Invoice] Button
9. List refreshes with new invoice (Status: "draft")
```

**Auto-Populated Fields:**
- Delivery Note ID selection
- Customer Name (from delivery note)
- Invoice Date (today's date)

**Optional Fields:**
- Tax Rate (defaults to 18%)
- Invoice Type (defaults to "standard")

**Initial Status:**
- `status = 'draft'`
- `payment_status = 'unpaid'`
- `amount_paid = 0`

**Backend:**
- `POST /api/selling/sales-invoices`
- **FIXED:** Now returns `customer_name` via multi-table JOIN
- Query joins: invoice → delivery_note → sales_order → customer

---

### **BUYING MODULE - Complete Flow (PO → GRN → Purchase Invoice)**

#### **Step 1: Create Purchase Order**
Location: `/buying/purchase-orders`
**Note:** Uses existing form navigation (can be converted to modal later)

```
1. Navigate to `/buying/purchase-orders`
2. Create PO with items and quantities
3. Status: "draft"
4. Submit to change status to "submitted" or "confirmed"
```

---

#### **Step 2: Create Goods Receipt Note (GRN)** ✅
Location: `/buying/purchase-receipts` - Click [Create GRN] Button

```
1. Click [Create GRN] Button → Opens CreateGRNModal
2. Select Purchase Order (only SUBMITTED/CONFIRMED)
   - Supplier name auto-populates
   - PO number shown
3. Enter Receipt Date (auto-filled with today)
4. Add Received Items:
   - Click [+ Add Item] to add rows
   - Item Code * (required)
   - Qty Received * (required, in units)
   - Remarks (optional, condition/notes)
   - Can add multiple items
5. Remove items with [🗑️] button if needed
6. See Summary: Total Items & Total Quantity
7. Click [Create GRN] Button
8. List refreshes with new GRN (Status: "draft")
```

**Features:**
- Multi-item support
- Dynamic add/remove items
- Summary card shows total items and quantity
- Quantity validation (minimum 1)

**Backend:**
- `POST /api/purchase-receipts`
- Creates with `status = 'draft'`
- Items array structure:
  ```json
  {
    "po_item_id": "string",
    "received_qty": number,
    "remarks": "string"
  }
  ```

---

#### **Step 3: Accept/Update GRN Status** ✅
Location: `/buying/purchase-receipts`

```
1. View GRN in list (Status: "draft")
2. To change status to "accepted":
   - Navigate to GRN detail page
   - Click [Accept] or use status update
3. Status changes: draft → accepted
4. (Required before creating purchase invoice)
```

**Important:**
- Only ACCEPTED GRNs can be used for invoices
- Backend has endpoints for: accept, reject, inspect

---

#### **Step 4: Create Purchase Invoice** ✅
Location: `/buying/purchase-invoices` - Click [Create Invoice] Button

```
1. Click [Create Invoice] Button → Opens CreatePurchaseInvoiceModal
2. Select GRN (only ACCEPTED ones show)
   - Supplier name auto-populates
   - PO number auto-populates
3. Invoice Date (auto-filled with today)
4. Enter Net Amount (₹)
5. Select Tax Rate (0%, 5%, 12%, 18%, 28%)
6. Tax Amount (auto-calculated from net + tax rate)
7. Enter Due Date
8. Gross Amount (auto-calculated: net + tax)
9. (Optional) Add Notes
10. Summary card shows: Net + Tax = Gross (auto-calculated)
11. Click [Create Invoice] Button
12. List refreshes with new invoice
```

**Auto-Calculated Fields:**
- Tax Amount = (Net Amount × Tax Rate) / 100
- Gross Amount = Net Amount + Tax Amount
- All calculations happen in real-time as you type

**Auto-Populated Fields:**
- GRN number selection
- Supplier name
- PO number
- Invoice Date (today)

**Initial Status:**
- `status = 'draft'`
- `payment_status = 'unpaid'`

**Backend:**
- `POST /api/purchase-invoices`
- Supports tax calculations
- Returns: Complete invoice with supplier info

---

## 🔄 Complete End-to-End Flows

### **SELLING: Sales Order → Delivery → Invoice**

```
┌─────────────────────────────────────────────────────────────────┐
│ SELLING WORKFLOW - COMPLETE FLOW                                │
└─────────────────────────────────────────────────────────────────┘

PHASE 1: ORDER CREATION
├─ Go to: /selling/sales-orders
├─ Click: [New Sales Order] Button
├─ Modal Opens: CreateSalesOrderModal
├─ Fill: Customer, Amount, Delivery Date, Terms
├─ Submit: Creates SO (status: draft)
└─ Result: SO visible in list

PHASE 2: ORDER CONFIRMATION
├─ Go to: /selling/sales-orders
├─ Click: [✏️ Edit] on draft SO
├─ Modal Opens: EditSalesOrderModal
├─ Action: Change status from "draft" → "confirmed"
├─ Submit: Updates SO status
└─ Result: SO now shows "confirmed" status

PHASE 3: DELIVERY CREATION
├─ Go to: /selling/delivery-notes
├─ Click: [New Delivery Note] Button
├─ Modal Opens: CreateDeliveryNoteModal
├─ Select: The confirmed SO (auto-populates customer)
├─ Fill: Delivery Date, Quantity, Driver, Vehicle
├─ Submit: Creates DN (status: draft)
└─ Result: DN visible in list

PHASE 4: DELIVERY SUBMISSION
├─ Go to: /selling/delivery-notes
├─ Click: [📤 Submit] on draft DN
├─ Status Changes: draft → submitted → delivered (admin)
└─ Result: DN shows "delivered" status

PHASE 5: INVOICE CREATION
├─ Go to: /selling/sales-invoices
├─ Click: [New Invoice] Button
├─ Modal Opens: CreateInvoiceModal
├─ Select: Delivered DN (auto-populates customer, SO info)
├─ Fill: Amount, Due Date, Tax Rate, Type
├─ Submit: Creates Invoice (status: draft)
└─ Result: Invoice visible in list

PHASE 6: INVOICE SUBMISSION
├─ Go to: /selling/sales-invoices
├─ Click: [📤 Submit] on draft invoice
├─ Status Changes: draft → submitted
└─ Result: Invoice shows "submitted", awaiting payment

PHASE 7: PAYMENT & CLOSURE
├─ Update payment status when payment received
├─ Final Status: "paid" or "partially_paid"
└─ Complete: Invoice fully processed
```

---

### **BUYING: PO → GRN → Purchase Invoice**

```
┌─────────────────────────────────────────────────────────────────┐
│ BUYING WORKFLOW - COMPLETE FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

PHASE 1: PURCHASE ORDER (Existing Flow)
├─ Go to: /buying/purchase-orders
├─ Create: PO with items and quantities
├─ Status: draft → submitted/confirmed
└─ Result: PO ready for goods receipt

PHASE 2: GOODS RECEIPT (GRN CREATION) ✅ NEW MODAL
├─ Go to: /buying/purchase-receipts
├─ Click: [Create GRN] Button
├─ Modal Opens: CreateGRNModal
├─ Select: Confirmed/Submitted PO
├─ Add Items: Item code, qty received, remarks
├─ Submit: Creates GRN (status: draft)
└─ Result: GRN visible in list

PHASE 3: GRN INSPECTION & ACCEPTANCE
├─ Go to: /buying/purchase-receipts
├─ View: GRN details (draft status)
├─ Action: Inspect goods
├─ Update Status: draft → accepted/rejected/inspected
└─ Result: GRN shows accepted status

PHASE 4: PURCHASE INVOICE CREATION ✅ NEW MODAL
├─ Go to: /buying/purchase-invoices
├─ Click: [Create Invoice] Button
├─ Modal Opens: CreatePurchaseInvoiceModal
├─ Select: Accepted GRN (auto-populates PO, supplier)
├─ Fill: Net Amount, Tax Rate, Due Date
├─ Auto-Calculate: Tax Amount & Gross Amount
├─ Submit: Creates Invoice (status: draft)
└─ Result: Invoice visible in list

PHASE 5: INVOICE VERIFICATION & SUBMISSION
├─ Go to: /buying/purchase-invoices
├─ Review: Invoice details
├─ Action: Submit invoice
├─ Status: draft → submitted
└─ Result: Invoice awaiting payment processing

PHASE 6: PAYMENT & CLOSURE
├─ Process payment to supplier
├─ Mark invoice as paid
├─ Final Status: paid or partially_paid
└─ Complete: Invoice fully processed
```

---

## 📊 Data Validation & Business Rules

### **Sales Order Validation**
```
✅ Customer ID must exist in selling_customer table
✅ Amount must be > 0
✅ Order Date cannot be in future
✅ Delivery Date should be after Order Date
```

### **Delivery Note Validation**
```
✅ Sales Order must be in "confirmed" status
✅ Customer must be associated with SO
✅ Delivery Date must be provided
✅ Quantity must be > 0
```

### **Sales Invoice Validation**
```
✅ Delivery Note must be in "delivered" status
✅ Customer must be associated with DN
✅ Invoice Date must be provided
✅ Amount must be > 0
✅ Due Date must be after Invoice Date
✅ Tax Rate must be valid (0, 5, 12, 18, 28)
```

### **GRN Validation**
```
✅ Purchase Order must be in "submitted" or "confirmed" status
✅ At least one item required
✅ Each item must have: Item Code, Received Qty
✅ Received Qty must be > 0
✅ Receipt Date must be provided
```

### **Purchase Invoice Validation**
```
✅ GRN must be in "accepted" status
✅ Net Amount must be > 0
✅ Due Date must be provided
✅ Tax Rate must be valid (0, 5, 12, 18, 28)
✅ Tax and Gross amounts auto-calculated
```

---

## 🧪 Testing Checklist

### **Modal Creation & Display**
- [ ] Modal opens when button clicked
- [ ] Modal closes on Cancel or X
- [ ] Form resets after successful submission
- [ ] Error messages display correctly
- [ ] Loading state shows during submission
- [ ] Success message clears form

### **Data Population**
- [ ] Dropdowns show correct filtered data
- [ ] Auto-population works for linked fields
- [ ] Customer names appear from related tables
- [ ] Date fields default to today
- [ ] Currency fields format correctly

### **Form Validation**
- [ ] Required fields show error if empty
- [ ] Number fields validate input
- [ ] Date fields accept valid dates
- [ ] Submit button disabled on error
- [ ] Form clears on successful save

### **List Updates**
- [ ] New items appear in list after creation
- [ ] Status changes reflect immediately
- [ ] List refreshes without page reload
- [ ] Filters work with new items
- [ ] Pagination updates correctly

### **End-to-End Flow**
- [ ] SO created → shows in list
- [ ] SO status changed → can create DN
- [ ] DN created → shows in list
- [ ] DN marked delivered → can create invoice
- [ ] Invoice created → shows in list
- [ ] Complete flow works without navigation

---

## 🚀 Performance Notes

### **Modal Benefits**
1. **No Page Reloads**: Faster workflow
2. **Context Preservation**: List stays on screen
3. **Auto-Refresh**: List updates automatically
4. **Better UX**: Seamless creation experience
5. **Mobile Friendly**: Smaller screens work better

### **Data Fetching**
1. **Lazy Loading**: Data fetched only when modal opens
2. **Filtered Data**: Backend returns only relevant items
3. **Sorted Data**: Latest items shown first
4. **Pagination Ready**: Can add pagination if needed

---

## 📝 Notes for Future Enhancements

1. **Edit Modals**: Can add edit modals for existing records
2. **Multi-Select**: Allow selecting multiple items in one go
3. **Bulk Operations**: Create multiple records in sequence
4. **Templates**: Save and reuse common configurations
5. **Approval Workflows**: Add approval before status changes
6. **Notifications**: Real-time updates for related users
7. **Attachments**: Support for document uploads
8. **Comments**: Track conversation on each record
