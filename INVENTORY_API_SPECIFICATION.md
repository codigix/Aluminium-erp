# 📡 Inventory Module - API Specification

## Backend API Endpoints Required

All inventory module pages require these API endpoints to be implemented in your backend.

---

## 🏢 Warehouses API

### Get All Warehouses
```
GET /api/stock/warehouses
Response:
{
  "data": [
    {
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "location": "Mumbai",
      "manager_name": "John Doe",
      "contact_no": "9876543210",
      "email": "john@warehouse.com",
      "address": "123 Main St",
      "remarks": "Main storage facility"
    }
  ]
}
```

### Create Warehouse
```
POST /api/stock/warehouses
Body:
{
  "warehouse_name": "Main Warehouse",
  "location": "Mumbai",
  "manager_name": "John Doe",
  "contact_no": "9876543210",
  "email": "john@warehouse.com",
  "address": "123 Main St",
  "remarks": "Main storage facility"
}
Response:
{
  "data": { warehouse_id: 1, ... }
}
```

### Update Warehouse
```
PUT /api/stock/warehouses/{warehouse_id}
Body:
{
  "warehouse_name": "Main Warehouse",
  "location": "Mumbai",
  ...
}
Response:
{
  "data": { ... }
}
```

### Delete Warehouse
```
DELETE /api/stock/warehouses/{warehouse_id}
Response:
{
  "message": "Warehouse deleted"
}
```

---

## 📦 Stock Balance API

### Get Stock Balance
```
GET /api/stock/stock-balance?warehouse_id=1&item_code=ITEM001
Response:
{
  "data": [
    {
      "item_code": "ITEM001",
      "item_name": "Product Name",
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "quantity": 50,
      "uom": "pcs",
      "reorder_level": 20,
      "rate": 100.00,
      "quantity_balance": 50
    }
  ]
}
```

**Query Parameters:**
- `warehouse_id` (optional) - Filter by warehouse
- `item_code` (optional) - Filter by item

---

## 📝 Stock Entries API

### Get All Stock Entries
```
GET /api/stock/entries
Response:
{
  "data": [
    {
      "entry_id": 1,
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "entry_date": "2024-01-15",
      "reference_doctype": "purchase_receipt",
      "reference_name": "PR/2024/001",
      "total_items": 2,
      "items": [
        { "item_code": "ITEM001", "quantity": 10, "uom": "pcs" },
        { "item_code": "ITEM002", "quantity": 5, "uom": "pcs" }
      ],
      "remarks": "Purchase receipt entry"
    }
  ]
}
```

### Create Stock Entry
```
POST /api/stock/entries
Body:
{
  "warehouse_id": 1,
  "reference_doctype": "purchase_receipt",
  "reference_name": "PR/2024/001",
  "remarks": "Purchase receipt entry",
  "items": [
    { "item_code": "ITEM001", "qty": 10 },
    { "item_code": "ITEM002", "qty": 5 }
  ]
}
Response:
{
  "data": { entry_id: 1, ... }
}
```

### Delete Stock Entry
```
DELETE /api/stock/entries/{entry_id}
Response:
{
  "message": "Stock entry deleted"
}
```

---

## 📊 Stock Ledger API

### Get Stock Ledger
```
GET /api/stock/ledger?warehouse_id=1&item_code=ITEM001&from_date=2024-01-01&to_date=2024-01-31
Response:
{
  "data": [
    {
      "ledger_id": 1,
      "item_code": "ITEM001",
      "item_name": "Product Name",
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "posting_date": "2024-01-15",
      "transaction_type": "receipt",
      "qty_in": 10,
      "qty_out": null,
      "balance": 50,
      "rate": 100.00,
      "reference_doctype": "purchase_receipt",
      "reference_name": "PR/2024/001"
    }
  ]
}
```

**Query Parameters:**
- `warehouse_id` (optional)
- `item_code` (optional)
- `from_date` (optional) - Format: YYYY-MM-DD
- `to_date` (optional) - Format: YYYY-MM-DD

**Transaction Types:**
- `receipt` - Stock In
- `issue` - Stock Out
- `transfer_in` - Transfer In
- `transfer_out` - Transfer Out
- `adjustment` - Stock Adjustment

---

## 🚚 Stock Transfers API

### Get All Transfers
```
GET /api/stock/transfers
Response:
{
  "data": [
    {
      "transfer_id": 1,
      "from_warehouse_id": 1,
      "from_warehouse": "Main Warehouse",
      "to_warehouse_id": 2,
      "to_warehouse": "Secondary Warehouse",
      "transfer_date": "2024-01-15",
      "status": "in-transit",
      "item_count": 2,
      "items": [
        { "item_code": "ITEM001", "qty": 5 },
        { "item_code": "ITEM002", "qty": 3 }
      ],
      "remarks": "Transfer between warehouses"
    }
  ]
}
```

### Create Transfer
```
POST /api/stock/transfers
Body:
{
  "from_warehouse_id": 1,
  "to_warehouse_id": 2,
  "transfer_date": "2024-01-15",
  "status": "draft",
  "remarks": "Transfer between warehouses",
  "items": [
    { "item_code": "ITEM001", "qty": 5 },
    { "item_code": "ITEM002", "qty": 3 }
  ]
}
Response:
{
  "data": { transfer_id: 1, ... }
}
```

### Receive Transfer
```
PATCH /api/stock/transfers/{transfer_id}/receive
Body:
{
  "received_date": "2024-01-16"
}
Response:
{
  "data": { status: "received", ... }
}
```

### Delete Transfer
```
DELETE /api/stock/transfers/{transfer_id}
Response:
{
  "message": "Transfer deleted"
}
```

**Status Values:**
- `draft` - Initial state
- `submitted` - Submitted
- `in-transit` - In transit
- `received` - Completed
- `cancelled` - Cancelled

---

## 🏷️ Batch Tracking API

### Get All Batches
```
GET /api/stock/batches
Response:
{
  "data": [
    {
      "batch_id": 1,
      "item_code": "ITEM001",
      "item_name": "Product Name",
      "batch_no": "BATCH-001",
      "qty_total": 100,
      "qty_available": 80,
      "manufacturing_date": "2024-01-01",
      "expiry_date": "2024-12-31",
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "remarks": "High quality batch"
    }
  ]
}
```

### Create Batch
```
POST /api/stock/batches
Body:
{
  "item_code": "ITEM001",
  "batch_no": "BATCH-001",
  "qty_total": 100,
  "qty_available": 80,
  "manufacturing_date": "2024-01-01",
  "expiry_date": "2024-12-31",
  "warehouse_id": 1,
  "remarks": "High quality batch"
}
Response:
{
  "data": { batch_id: 1, ... }
}
```

### Delete Batch
```
DELETE /api/stock/batches/{batch_id}
Response:
{
  "message": "Batch deleted"
}
```

---

## ⚖️ Reconciliation API

### Get All Reconciliations
```
GET /api/stock/reconciliations
Response:
{
  "data": [
    {
      "reconciliation_id": 1,
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "reconciliation_date": "2024-01-15",
      "status": "draft",
      "item_count": 2,
      "items": [
        {
          "item_code": "ITEM001",
          "system_qty": 50,
          "physical_qty": 48,
          "variance": -2,
          "variance_percentage": -4.0
        }
      ],
      "remarks": "Monthly reconciliation"
    }
  ]
}
```

### Create Reconciliation
```
POST /api/stock/reconciliations
Body:
{
  "warehouse_id": 1,
  "reconciliation_date": "2024-01-15",
  "status": "draft",
  "remarks": "Monthly reconciliation",
  "items": [
    {
      "item_code": "ITEM001",
      "system_qty": 50,
      "physical_qty": 48
    }
  ]
}
Response:
{
  "data": { reconciliation_id: 1, ... }
}
```

### Submit Reconciliation
```
PATCH /api/stock/reconciliations/{reconciliation_id}/submit
Body:
{
  "submitted_date": "2024-01-15"
}
Response:
{
  "data": { status: "submitted", ... }
}
```

### Delete Reconciliation
```
DELETE /api/stock/reconciliations/{reconciliation_id}
Response:
{
  "message": "Reconciliation deleted"
}
```

**Status Values:**
- `draft` - Under preparation
- `submitted` - Finalized and submitted

---

## ⚠️ Reorder Management API

### Get All Reorder Settings
```
GET /api/stock/reorder-management
Response:
{
  "data": [
    {
      "reorder_id": 1,
      "item_code": "ITEM001",
      "item_name": "Product Name",
      "warehouse_id": 1,
      "warehouse_name": "Main Warehouse",
      "reorder_level": 50,
      "reorder_quantity": 100,
      "min_order_qty": 10,
      "supplier_id": 1,
      "lead_time_days": 5,
      "active": true
    }
  ]
}
```

### Create Reorder Setting
```
POST /api/stock/reorder-management
Body:
{
  "item_code": "ITEM001",
  "warehouse_id": 1,
  "reorder_level": 50,
  "reorder_quantity": 100,
  "min_order_qty": 10,
  "supplier_id": 1,
  "lead_time_days": 5,
  "active": true
}
Response:
{
  "data": { reorder_id: 1, ... }
}
```

### Update Reorder Setting
```
PUT /api/stock/reorder-management/{reorder_id}
Body:
{
  "reorder_level": 50,
  "reorder_quantity": 100,
  ...
}
Response:
{
  "data": { ... }
}
```

### Delete Reorder Setting
```
DELETE /api/stock/reorder-management/{reorder_id}
Response:
{
  "message": "Reorder setting deleted"
}
```

---

## 📈 Analytics API

### Get Inventory Analytics
```
GET /api/analytics/inventory
Response:
{
  "data": {
    "total_value": 50000.00,
    "total_items": 100,
    "low_stock_items": 5,
    "out_of_stock_items": 2,
    "turnover_rate": 2.5,
    "warehouse_distribution": [
      {
        "warehouse_id": 1,
        "warehouse_name": "Main Warehouse",
        "item_count": 50,
        "value": 30000.00,
        "occupancy": 75
      }
    ],
    "top_items": [
      {
        "item_code": "ITEM001",
        "item_name": "Product Name",
        "quantity": 100,
        "value": 10000.00
      }
    ],
    "stock_movements_count": 150,
    "inward_qty": 1000,
    "outward_qty": 800
  }
}
```

---

## 📋 Additional Required APIs

### Get Items (for dropdowns)
```
GET /api/items?limit=1000
Response:
{
  "data": [
    {
      "item_code": "ITEM001",
      "item_name": "Product Name",
      "uom": "pcs",
      "rate": 100.00
    }
  ]
}
```

### Get Item Details (optional)
```
GET /api/items/{item_code}
Response:
{
  "data": {
    "item_code": "ITEM001",
    "item_name": "Product Name",
    "uom": "pcs",
    "rate": 100.00,
    "hsn_code": "123456",
    "category": "Category Name"
  }
}
```

---

## 🔧 Error Response Format

All API errors should follow this format:
```
Response (400/404/500):
{
  "error": "Error message",
  "message": "Detailed error message",
  "data": null
}
```

---

## ✅ Response Format Standards

All success responses should follow:
```
{
  "data": { ... } or [ ... ],
  "message": "Success message",
  "status": 200
}
```

---

## 📊 Data Validation Rules

### Warehouse
- `warehouse_name` - Required, string, max 100 chars
- `location` - Required, string, max 100 chars
- `manager_name` - Optional, string, max 100 chars
- `contact_no` - Optional, string, valid phone
- `email` - Optional, string, valid email

### Stock Entry
- `warehouse_id` - Required, integer
- `items` - Required, array with min 1 item
- `reference_doctype` - Optional, enum: [purchase_receipt, production, adjustment]

### Stock Transfer
- `from_warehouse_id` - Required, integer, not equal to to_warehouse_id
- `to_warehouse_id` - Required, integer, not equal to from_warehouse_id
- `items` - Required, array with min 1 item
- `transfer_date` - Required, date format YYYY-MM-DD

### Batch
- `item_code` - Required, string
- `batch_no` - Required, string
- `qty_total` - Required, integer, > 0
- `qty_available` - Required, integer, <= qty_total
- `expiry_date` - Required, date format YYYY-MM-DD

### Reconciliation
- `warehouse_id` - Required, integer
- `items` - Required, array with min 1 item
- `items[].system_qty` - Required, integer >= 0
- `items[].physical_qty` - Required, integer >= 0

### Reorder Setting
- `item_code` - Required, string
- `warehouse_id` - Required, integer
- `reorder_level` - Required, integer > 0
- `reorder_quantity` - Required, integer > 0
- `lead_time_days` - Optional, integer >= 0

---

## 🔐 Authentication

All endpoints require:
```
Headers:
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
```

---

## 📝 Query Parameters

### Pagination (optional, for list endpoints)
```
GET /api/stock/warehouses?page=1&limit=10
```

### Filters (optional, vary by endpoint)
```
GET /api/stock/stock-balance?warehouse_id=1&item_code=ITEM001
GET /api/stock/ledger?from_date=2024-01-01&to_date=2024-01-31
```

---

## 🎯 Implementation Checklist

Use this to track API implementation:

### Warehouses
- [ ] GET /api/stock/warehouses
- [ ] POST /api/stock/warehouses
- [ ] PUT /api/stock/warehouses/{id}
- [ ] DELETE /api/stock/warehouses/{id}

### Stock Balance
- [ ] GET /api/stock/stock-balance

### Stock Entries
- [ ] GET /api/stock/entries
- [ ] POST /api/stock/entries
- [ ] DELETE /api/stock/entries/{id}

### Stock Ledger
- [ ] GET /api/stock/ledger

### Stock Transfers
- [ ] GET /api/stock/transfers
- [ ] POST /api/stock/transfers
- [ ] PATCH /api/stock/transfers/{id}/receive
- [ ] DELETE /api/stock/transfers/{id}

### Batch Tracking
- [ ] GET /api/stock/batches
- [ ] POST /api/stock/batches
- [ ] DELETE /api/stock/batches/{id}

### Reconciliation
- [ ] GET /api/stock/reconciliations
- [ ] POST /api/stock/reconciliations
- [ ] PATCH /api/stock/reconciliations/{id}/submit
- [ ] DELETE /api/stock/reconciliations/{id}

### Reorder Management
- [ ] GET /api/stock/reorder-management
- [ ] POST /api/stock/reorder-management
- [ ] PUT /api/stock/reorder-management/{id}
- [ ] DELETE /api/stock/reorder-management/{id}

### Analytics
- [ ] GET /api/analytics/inventory

### Supporting APIs
- [ ] GET /api/items
- [ ] GET /api/items/{id}

---

## 🚀 Testing the APIs

Use Postman or similar tool to test:

```
1. Get all warehouses
   GET http://localhost:5000/api/stock/warehouses

2. Create warehouse
   POST http://localhost:5000/api/stock/warehouses
   Body: { "warehouse_name": "Test", "location": "Mumbai" }

3. Get stock balance
   GET http://localhost:5000/api/stock/stock-balance

4. Get analytics
   GET http://localhost:5000/api/analytics/inventory
```

---

## 📞 API Support

If you need to modify/extend APIs:
1. Ensure response format matches this spec
2. Validate all required fields
3. Return appropriate HTTP status codes
4. Include proper error messages
5. Add CORS headers for frontend access

---

## ✨ Success!

Once all these APIs are implemented and tested, the entire Inventory Module will work perfectly! 🎉