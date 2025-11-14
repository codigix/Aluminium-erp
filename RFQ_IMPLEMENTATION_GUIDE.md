# 📋 RFQ (Request for Quotation) Implementation Guide

## ✅ Current Status
- **Backend**: READY ✅
- **Frontend**: READY ✅
- **Database**: READY ✅
- **Sample Data**: READY ✅

---

## 📚 What is RFQ?

**Request for Quotation (RFQ)** is a formal request sent to suppliers asking them to provide price quotations for specific items. The workflow is:

1. **Create RFQ** → Select items and suppliers
2. **Send RFQ** → Change status from Draft to Sent
3. **Receive Responses** → Suppliers submit quotations
4. **Evaluate** → Compare supplier quotes
5. **Close RFQ** → Finalize the process

---

## 🗄️ Database Schema

### RFQ Tables

#### 1. `rfq` (Main RFQ table)
```sql
- rfq_id (VARCHAR 50) PRIMARY KEY
- created_by_id (VARCHAR 50) FK to contact
- created_date (DATE)
- valid_till (DATE)
- status ENUM('draft', 'sent', 'responses_received', 'closed')
- created_at, updated_at (TIMESTAMP)
```

#### 2. `rfq_item` (Items included in RFQ)
```sql
- id (INT) AUTO_INCREMENT PRIMARY KEY
- rfq_id (VARCHAR 50) FK to rfq
- item_code (VARCHAR 100) FK to item
- qty (DECIMAL 10,2)
- uom (VARCHAR 50)
```

#### 3. `rfq_supplier` (Suppliers to receive RFQ)
```sql
- id (INT) AUTO_INCREMENT PRIMARY KEY
- rfq_id (VARCHAR 50) FK to rfq
- supplier_id (VARCHAR 50) FK to supplier
```

#### 4. `supplier_quotation` (Supplier responses)
```sql
- supplier_quotation_id (VARCHAR 50) PRIMARY KEY
- supplier_id (VARCHAR 50) FK to supplier
- rfq_id (VARCHAR 50) FK to rfq
- quote_date (DATE)
- total_value (DECIMAL 15,2)
- created_at, updated_at (TIMESTAMP)
```

#### 5. `supplier_quotation_item` (Items in supplier quote)
```sql
- id (INT) AUTO_INCREMENT PRIMARY KEY
- supplier_quotation_id (VARCHAR 50) FK to supplier_quotation
- item_code (VARCHAR 100) FK to item
- rate (DECIMAL 10,2)
- lead_time_days (INT)
- min_qty (DECIMAL 10,2)
```

---

## 🎯 How to Create an RFQ

### Step 1: Navigate to RFQ Page
```
Path: http://localhost:5173/buying/rfqs
Button: "+ New RFQ"
```

### Step 2: Fill in RFQ Form

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Created By | Dropdown | Yes | Select a contact (Procurement person) |
| Valid Till | Date | Yes | Quote validity date |
| Load from MR | Dropdown | No | Auto-load items from Material Request |

**Available Contacts** (sample data):
- John Procurement (john@company.com)
- Sarah Supply (sarah@company.com)
- Mike Buyer (mike@company.com)

### Step 3: Add Items

**Option A: Load from Material Request**
1. Select an approved Material Request from dropdown
2. Items will automatically load from that MR

**Option B: Manual Entry** (if you have pre-loaded items)
- System will display items table if available

**Available Items** (sample data):
- ITEM-001: Aluminium Ingot (KG)
- ITEM-002: Copper Sheet (SHEET)
- ITEM-003: Stainless Steel Rod (ROD)
- ITEM-004: Packaging Box (BOX)
- ITEM-005: Labels (ROLL)

### Step 4: Add Suppliers

1. Select supplier from dropdown
2. Click "Add Supplier"
3. Repeat for multiple suppliers

**Available Suppliers** (sample data):
- Any active suppliers in the system (created earlier)

### Step 5: Submit RFQ

1. Verify all fields are filled:
   - ✓ Created By: Selected
   - ✓ Valid Till: Date selected
   - ✓ Items: At least 1 item
   - ✓ Suppliers: At least 1 supplier

2. Click "Save"
3. You should see: ✅ "RFQ created successfully"

---

## 📊 RFQ Status Workflow

```
DRAFT 
  ↓ (Click "Send")
SENT 
  ↓ (Suppliers submit quotes)
RESPONSES_RECEIVED
  ↓ (Review & select)
CLOSED
```

### Status Actions

| Status | Available Actions | Next Status |
|--------|------------------|------------|
| draft | Send, Delete | sent |
| sent | View Responses, Close | responses_received, closed |
| responses_received | View Responses, Close | closed |
| closed | View only | - |

---

## 🔌 API Endpoints

### 1. List All RFQs
```
GET /api/rfqs
GET /api/rfqs?status=draft
GET /api/rfqs?search=RFQ-123
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rfq_id": "RFQ-1730000000000",
      "created_by_name": "John Procurement",
      "created_date": "2025-10-31",
      "valid_till": "2025-11-15",
      "supplier_count": 3,
      "status": "draft"
    }
  ]
}
```

### 2. Create RFQ
```
POST /api/rfqs
Content-Type: application/json

{
  "created_by_id": "CONT-001",
  "valid_till": "2025-11-15",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 100,
      "uom": "KG"
    }
  ],
  "suppliers": [
    {
      "supplier_id": "SUP-1234567890"
    }
  ]
}
```

**Required Fields:**
- `created_by_id`: Contact ID
- `valid_till`: Date string (YYYY-MM-DD)
- `items`: Array with at least 1 item
- `suppliers`: Array with at least 1 supplier

### 3. Get RFQ Details
```
GET /api/rfqs/{rfq_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rfq_id": "RFQ-1730000000000",
    "created_by_id": "CONT-001",
    "created_by_name": "John Procurement",
    "created_date": "2025-10-31",
    "valid_till": "2025-11-15",
    "status": "draft",
    "items": [
      {
        "item_code": "ITEM-001",
        "item_name": "Aluminium Ingot",
        "qty": 100,
        "uom": "KG"
      }
    ],
    "suppliers": [
      {
        "supplier_id": "SUP-1234567890",
        "supplier_name": "Supplier A"
      }
    ]
  }
}
```

### 4. Update RFQ (Draft only)
```
PUT /api/rfqs/{rfq_id}
Content-Type: application/json

{
  "valid_till": "2025-11-20",
  "items": [...],
  "suppliers": [...]
}
```

### 5. Send RFQ to Suppliers
```
PATCH /api/rfqs/{rfq_id}/send
```

Changes status: `draft` → `sent`

### 6. Mark Responses Received
```
PATCH /api/rfqs/{rfq_id}/receive-responses
```

Changes status: `sent` → `responses_received`

### 7. Close RFQ
```
PATCH /api/rfqs/{rfq_id}/close
```

Changes status: Any → `closed`

### 8. Get RFQ Responses (Supplier Quotations)
```
GET /api/rfqs/{rfq_id}/responses
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "supplier_quotation_id": "SQ-1234567890",
      "supplier_id": "SUP-123",
      "supplier_name": "Supplier A",
      "rfq_id": "RFQ-1234",
      "quote_date": "2025-11-01",
      "total_value": 50000.00,
      "created_at": "2025-11-01 10:30:00",
      "updated_at": "2025-11-01 10:30:00"
    }
  ]
}
```

### 9. Delete RFQ (Draft only)
```
DELETE /api/rfqs/{rfq_id}
```

Only draft RFQs can be deleted.

### 10. Get Pending RFQs
```
GET /api/rfqs/pending
```

Returns all draft RFQs.

### 11. Get Open RFQs
```
GET /api/rfqs/open
```

Returns RFQs with status `sent` or `responses_received`.

---

## 🧪 Testing the RFQ Module

### Test Case 1: Create RFQ
```bash
POST /api/rfqs
{
  "created_by_id": "CONT-001",
  "valid_till": "2025-11-20",
  "items": [
    {"item_code": "ITEM-001", "qty": 100, "uom": "KG"}
  ],
  "suppliers": [
    {"supplier_id": "SUP-1730000000000"}  # Replace with actual supplier ID
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "rfq_id": "RFQ-1730000000000",
    "status": "draft",
    ...
  }
}
```

### Test Case 2: List RFQs
```bash
GET /api/rfqs
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "rfq_id": "RFQ-1730000000000",
      "status": "draft",
      "supplier_count": 1,
      ...
    }
  ]
}
```

### Test Case 3: Send RFQ
```bash
PATCH /api/rfqs/RFQ-1730000000000/send
```

**Expected Response:**
```json
{
  "success": true,
  "message": "RFQ sent to suppliers",
  "data": {
    "rfq_id": "RFQ-1730000000000",
    "status": "sent",
    ...
  }
}
```

---

## 🐛 Troubleshooting

### Issue 1: "Created By" dropdown is empty
**Cause**: No contacts in database
**Solution**: Create contacts first
```sql
INSERT INTO contact (contact_id, name, email, phone, role) 
VALUES ('CONT-004', 'New Contact', 'contact@company.com', '9876543213', 'Manager');
```

### Issue 2: "No items found" when creating RFQ
**Cause**: No items in database
**Solution**: Create items first
```sql
INSERT INTO item (item_code, name, description, uom, category) 
VALUES ('ITEM-006', 'New Item', 'Description', 'UNIT', 'Category');
```

### Issue 3: "At least one supplier is required"
**Cause**: Supplier not selected
**Solution**: Select a supplier from dropdown and click "Add Supplier"

### Issue 4: Cannot update RFQ
**Cause**: RFQ status is not "draft"
**Solution**: Only draft RFQs can be updated. Once sent, you cannot edit it.

### Issue 5: Cannot delete RFQ
**Cause**: RFQ status is not "draft"
**Solution**: Only draft RFQs can be deleted.

---

## 📋 Frontend Components

### Main Files

1. **RFQs.jsx** - RFQ List Page
   - Location: `frontend/src/pages/Buying/RFQs.jsx`
   - Shows all RFQs with filters
   - Actions: View, Send, Delete, Close

2. **RFQForm.jsx** - RFQ Creation/Edit Form
   - Location: `frontend/src/pages/Buying/RFQForm.jsx`
   - Create new RFQ
   - Edit draft RFQ
   - Load items from Material Request

### Key Features

- ✅ Create new RFQ
- ✅ List all RFQs with filters
- ✅ View RFQ details
- ✅ Send RFQ to suppliers
- ✅ View supplier responses
- ✅ Close RFQ
- ✅ Delete draft RFQ
- ✅ Load items from Material Request
- ✅ Multiple suppliers support
- ✅ Date validation

---

## 🔧 Backend Components

### Main Files

1. **RFQController.js** - API Controller
   - Location: `backend/src/controllers/RFQController.js`
   - Handles all RFQ operations

2. **RFQModel.js** - Database Model
   - Location: `backend/src/models/RFQModel.js`
   - Executes database queries

3. **rfqs.js** - API Routes
   - Location: `backend/src/routes/rfqs.js`
   - Defines all RFQ endpoints

---

## 📚 Quick Reference

### Database Queries

**Create sample contact:**
```sql
INSERT INTO contact (contact_id, name, email, phone, role) 
VALUES ('CONT-NEW', 'Name', 'email@company.com', '9876543210', 'Role');
```

**Create sample item:**
```sql
INSERT INTO item (item_code, name, description, uom, category) 
VALUES ('ITEM-NEW', 'Name', 'Description', 'UNIT', 'Category');
```

**View all RFQs:**
```sql
SELECT * FROM rfq ORDER BY created_date DESC;
```

**View RFQ items:**
```sql
SELECT * FROM rfq_item WHERE rfq_id = 'RFQ-xxx';
```

**View RFQ suppliers:**
```sql
SELECT * FROM rfq_supplier WHERE rfq_id = 'RFQ-xxx';
```

---

## 🚀 Next Steps

1. ✅ Create contacts (if not done)
2. ✅ Create items (if not done)
3. ✅ Create suppliers (if not done)
4. ✅ Navigate to RFQ module
5. ✅ Create your first RFQ
6. ✅ Send to suppliers
7. ✅ Monitor supplier responses

---

## 📞 Support

If you encounter any issues:
1. Check the database for sample data
2. Verify API responses in browser console
3. Check backend logs for errors
4. Ensure all required fields are filled

---

**Status**: ✅ READY FOR USE
**Last Updated**: 2025-10-31
**Version**: 1.0