# 🚀 BUYING MODULE - QUICK START GUIDE

## 5-Minute Setup to Get Started

### Step 1: Initialize Database
Execute the init.sql script to create all tables:

```bash
mysql -h localhost -u root -p aluminium_erp < backend/scripts/init.sql
```

Or if you have Docker:
```bash
docker-compose up
```

### Step 2: Start Services
```bash
# Start backend
npm run dev:backend

# In another terminal, start frontend
npm run dev:frontend
```

### Step 3: Access the Application
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000
- **Dashboard:** http://localhost:5173/

---

## 📋 Complete Buying Workflow (Step-by-Step)

### STEP 1: Create Material Request (MR)
```
URL: http://localhost:5173/buying/material-requests
- Click "+ New Material Request"
- Fill in:
  * Requested By: Select contact/requester
  * Department: Production / Maintenance / Store
  * Required By: Date when needed
  * Purpose: Why it's needed
- Add Items:
  * Select Item from dropdown
  * Enter Quantity
  * UOM auto-fills
  * Click "Add Item"
- Click "Save Material Request"
Status: DRAFT
```

### STEP 2: Approve Material Request
```
URL: http://localhost:5173/buying/material-requests
- Find your created MR (status: DRAFT)
- Click "Approve" button
Status: APPROVED ✅

Alternative: Search or filter by status
```

### STEP 3: Create RFQ from Approved MR
```
URL: http://localhost:5173/buying/rfq/new
- Option A: Load from Material Request
  * Select MR from dropdown
  * Items auto-populate ✅
  
- Option B: Manual selection
  * Add items manually
  
- Fill in:
  * Created By: Select contact
  * Valid Till: Quotation validity date
  
- Add Suppliers:
  * Select each supplier
  * Click "Add Supplier"
  * Repeat for multiple suppliers
  
- Click "Save RFQ"
Status: DRAFT
```

### STEP 4: Send RFQ to Suppliers
```
URL: http://localhost:5173/buying/rfqs
- Find your created RFQ (status: DRAFT)
- Click "Send" button
Status: SENT ✉️

Suppliers now can respond with quotations
```

### STEP 5: Record Supplier Quotations
```
URL: http://localhost:5173/buying/quotation/new
- For each supplier response:
  * Select Supplier
  * Select the RFQ
  * Items auto-populate from RFQ
  * For each item, enter:
    - Rate (price)
    - Lead Time (days)
    - Min Quantity
  * Total Value auto-calculates ✅
  
- Click "Save Quotation"
Status: DRAFT

Repeat for each supplier's response
```

### STEP 6: Submit Quotations
```
URL: http://localhost:5173/buying/quotations
- Find each supplier quotation (status: DRAFT)
- Click "Submit" button
Status: RECEIVED

Now you can review and compare
```

### STEP 7: Compare & Select Best Quote
```
URL: http://localhost:5173/buying/quotations
- View all quotations for the RFQ
- Compare by price, lead time, supplier rating
- Click "Accept" on the best quotation
Status: ACCEPTED ✅

Other quotations: Click "Reject"
Status: REJECTED
```

### STEP 8: Create Purchase Order
```
URL: http://localhost:5173/buying/purchase-order/new
- From Accepted Quotation:
  * PO auto-fills:
    - Supplier
    - Items
    - Rates
    - Quantities
    
- Modify if needed:
  * Expected delivery date
  * Add notes/terms
  
- Click "Save Purchase Order"
Status: DRAFT

Then click "Submit" to send to supplier
Status: SUBMITTED
```

### STEP 9: Receive Goods (GRN)
```
URL: http://localhost:5173/buying/purchase-receipts
- Click "+ New Receipt"
- Select PO number
- Items from PO load automatically ✅
- For each item, enter:
  * Received Quantity
  * Accepted Quantity (after QC)
  * Rejected Quantity (if any)
  * Batch number
  
- Click "Save & Accept"
Status: ACCEPTED
Stock automatically updates ✅
```

### STEP 10: Create Purchase Invoice
```
URL: http://localhost:5173/buying/purchase-invoices
- Click "+ New Invoice"
- Link to: PO or GRN
- Items and rates auto-populate ✅
- Add:
  * Invoice number
  * Tax details (auto-calculated)
  * Payment terms
  
- Click "Save Invoice"
Status: DRAFT

Then click "Submit"
Status: SUBMITTED

After payment:
Click "Mark as Paid"
Status: PAID ✅
```

---

## 📊 Viewing & Managing

### View All Material Requests
```
URL: http://localhost:5173/buying/material-requests
- Filter by Status: Draft, Approved, Converted, Cancelled
- Filter by Department: Production, Maintenance, Store
- Search by MR ID or Requester Name
- Actions: View, Approve, Reject, Delete
```

### View All RFQs
```
URL: http://localhost:5173/buying/rfqs
- Filter by Status: Draft, Sent, Responses Received, Closed
- Search by RFQ ID
- Actions: View, Send, View Responses, Close, Delete
```

### View All Quotations
```
URL: http://localhost:5173/buying/quotations
- Filter by Status: Draft, Received, Accepted, Rejected
- Search by Quotation ID or Supplier
- Actions: View, Submit, Accept, Reject, Delete
```

### View All Purchase Orders
```
URL: http://localhost:5173/buying/purchase-orders
- Filter by Status, Supplier, Date Range
- Actions: View, Update, Submit
```

### View All GRNs
```
URL: http://localhost:5173/buying/purchase-receipts
- Search by PO number
- Actions: View, Accept/Reject
- Automatic stock update on accept
```

### View All Invoices
```
URL: http://localhost:5173/buying/purchase-invoices
- Filter by Supplier, Status, Date
- Actions: View, Submit, Mark as Paid
```

---

## 🔍 Key Workflows at a Glance

### Quick Order (Skip MR & RFQ)
```
Material Request (APPROVED)
  ↓
Create PO directly (skip RFQ & Quotation)
  ↓
Submit PO
  ↓
Receive Goods (GRN)
  ↓
Create Invoice
```

### Full Procurement Process
```
Material Request (Draft)
  ↓ (Approve)
Material Request (Approved)
  ↓
Create RFQ
  ↓ (Send)
RFQ (Sent)
  ↓
Receive Quotations
  ↓ (Submit)
Quotations (Received)
  ↓ (Compare)
Accept Best Quote
  ↓
Create PO from Quotation
  ↓ (Submit)
PO (Submitted)
  ↓
Receive Goods (GRN)
  ↓
Create Invoice from GRN
  ↓ (Submit & Pay)
Invoice (Paid)
```

### Update Existing MR
```
Material Request (Draft)
  ↓
Click "View" on the MR
  ↓
Click "Edit" button
  ↓
Modify items, quantities, dates
  ↓
Click "Save Changes"
  ✅ Only possible in Draft status
```

---

## 🎯 Common Tasks

### Search for a Material Request
1. Go to Material Requests
2. Use Search field: Enter MR ID or Requester Name
3. Filter by Department if needed
4. Click on row to view details

### Compare Quotations
1. Go to Quotations
2. Filter by Status: "Received"
3. Filter by RFQ ID (to see same RFQ quotes)
4. Compare Prices, Lead Times, Supplier Ratings

### Track Order Status
1. Go to Purchase Orders
2. View status (Draft → Submitted → Received → Billed)
3. Click order to see items and quantities

### Check Stock Received
1. Go to Purchase Receipts
2. Search by PO number
3. View accepted and rejected quantities
4. Stock updated automatically after accept

### View Invoice History
1. Go to Purchase Invoices
2. Filter by Supplier
3. Filter by Status (Draft, Submitted, Paid)
4. View total invoice amounts

---

## ⚙️ Configuration

### Add New Department
Edit `MaterialRequests.jsx`:
```javascript
const [departments, setDepartments] = useState([
  'Production',    // ← Existing
  'Maintenance',   // ← Existing
  'Store',         // ← Existing
  'Quality',       // ← Add new
  'Engineering'    // ← Add new
])
```

### Change Default MR Status
Edit `MaterialRequestModel.js`:
```javascript
// Line 76
const [result] = await db.execute(
  '... status = ?)',
  [..., 'draft']  // ← Change to 'approved' if needed
)
```

### Modify RFQ Validity Default
Edit `RFQForm.jsx`:
```javascript
// Add days to today
const defaultDate = new Date()
defaultDate.setDate(defaultDate.getDate() + 7)  // ← Change days
```

---

## 🆘 Troubleshooting

### "Failed to fetch material requests"
- **Check:** Backend is running (http://localhost:5000)
- **Check:** Database has tables
- **Fix:** Run init.sql again

### Dropdown showing empty options
- **Check:** Master data exists (Suppliers, Items, Contacts)
- **Create:** Sample data first
- **Fix:** Navigate to Suppliers/Items pages and create records

### Can't approve Material Request
- **Check:** MR status is "draft"
- **Can't:** Approve if already approved/converted/cancelled
- **Fix:** Only draft MRs can be approved

### Items not loading in RFQ
- **Check:** Have you selected a Material Request?
- **Fix:** Select from "Load from Material Request" dropdown
- **Or:** Manually add items using item selector

### Quotation total not calculating
- **Check:** Have you entered rates for all items?
- **Fix:** Enter rate for each item
- **Auto:** Total calculates when rates are entered

### Stock not updating after GRN
- **Check:** Did you click "Accept"?
- **Fix:** Submit GRN with "Accept" status
- **Verify:** Check Stock page to confirm

---

## 📱 Mobile Support

All pages are responsive and work on mobile:
- List pages: Single column
- Forms: Stack vertically
- Tables: Horizontal scroll if needed
- Buttons: Touch-friendly size

---

## 🔐 Permissions

### What you can do:
- ✅ Create MR (status: Draft)
- ✅ Edit MR (only if Draft)
- ✅ Approve/Reject MR (any status)
- ✅ Delete MR (only if Draft)
- ✅ Create RFQ from approved MR
- ✅ Send RFQ to suppliers
- ✅ Create quotations
- ✅ Compare quotations
- ✅ Create PO from quotation
- ✅ Create GRN from PO
- ✅ Create Invoice

### What you cannot do:
- ❌ Edit MR (if status ≠ Draft)
- ❌ Delete MR (if status ≠ Draft)
- ❌ Edit RFQ (if status ≠ Draft)
- ❌ Delete RFQ (if status ≠ Draft)
- ❌ Edit Quotation (if status ≠ Draft)

---

## 📚 Resources

- Full API Reference: `API.md`
- Database Schema: `backend/scripts/init.sql`
- Architecture Details: `ARCHITECTURE.md`
- Complete Feature List: `BUYING_MODULE_COMPLETE.md`

---

**Happy Procurement! 🎉**

For any issues or questions, check the troubleshooting section or refer to the complete documentation.