# Complete API Reference - Buying Module

**Base URL**: `http://localhost:5000/api`

---

## 📋 Table of Contents

1. [Health Check](#health-check)
2. [Purchase Orders](#purchase-orders)
3. [Items](#items)
4. [Purchase Receipts (GRN)](#purchase-receipts-grn)
5. [Purchase Invoices](#purchase-invoices)
6. [Suppliers](#suppliers)

---

## Health Check

### Check API Status
```http
GET /health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## Purchase Orders

### Create Purchase Order
```http
POST /purchase-orders
Content-Type: application/json

{
  "supplier_id": "SUP001",
  "order_date": "2025-01-15",
  "expected_date": "2025-01-20",
  "currency": "INR",
  "created_by_id": "CONT001",
  "items": [
    {
      "item_code": "ITEM001",
      "qty": 100,
      "uom": "KG",
      "rate": 1500,
      "schedule_date": "2025-01-20"
    },
    {
      "item_code": "ITEM002",
      "qty": 50,
      "uom": "PCS",
      "rate": 2000
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "po_no": "PO-1704024600000",
    "status": "created"
  }
}
```

---

### List Purchase Orders
```http
GET /purchase-orders?supplier_id=SUP001&status=submitted&limit=50&offset=0
```

**Query Parameters**:
- `supplier_id` (optional) - Filter by supplier
- `status` (optional) - Filter by status: draft, submitted, to_receive, partially_received, completed, cancelled
- `order_date_from` (optional) - Start date (YYYY-MM-DD)
- `order_date_to` (optional) - End date (YYYY-MM-DD)
- `limit` (optional) - Records per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "po_no": "PO-1704024600000",
      "supplier_id": "SUP001",
      "supplier_name": "ABC Aluminium Ltd.",
      "order_date": "2025-01-15",
      "expected_date": "2025-01-20",
      "currency": "INR",
      "total_value": 200000,
      "status": "submitted",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Purchase Order Details
```http
GET /purchase-orders/PO-1704024600000
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "po_no": "PO-1704024600000",
    "supplier_id": "SUP001",
    "supplier_name": "ABC Aluminium Ltd.",
    "gstin": "AAAAT1234F",
    "order_date": "2025-01-15",
    "expected_date": "2025-01-20",
    "currency": "INR",
    "total_value": 200000,
    "status": "submitted",
    "items": [
      {
        "po_item_id": "uuid",
        "item_code": "ITEM001",
        "item_name": "Aluminium Ingot A380",
        "qty": 100,
        "uom": "KG",
        "rate": 1500,
        "schedule_date": "2025-01-20",
        "received_qty": 0
      }
    ],
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### Update Purchase Order
```http
PUT /purchase-orders/PO-1704024600000
Content-Type: application/json

{
  "expected_date": "2025-01-22",
  "status": "to_receive"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "affectedRows": 1
  }
}
```

---

### Submit Purchase Order
```http
POST /purchase-orders/PO-1704024600000/submit
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true,
    "total_value": 200000
  }
}
```

---

### Delete Purchase Order
```http
DELETE /purchase-orders/PO-1704024600000
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

## Items

### Create Item
```http
POST /items
Content-Type: application/json

{
  "name": "New Item",
  "item_code": "ITEM006",
  "item_group": "Raw Materials",
  "description": "Item description",
  "uom": "KG",
  "hsn_code": "760711",
  "gst_rate": 18,
  "is_active": true
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "item_code": "ITEM006",
    "status": "created"
  }
}
```

---

### List Items
```http
GET /items?item_group=Raw%20Materials&search=aluminium&limit=50
```

**Query Parameters**:
- `item_group` (optional) - Filter by group
- `search` (optional) - Search by name or code
- `limit` (optional) - Records per page (default: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "item_code": "ITEM001",
      "name": "Aluminium Ingot A380",
      "item_group": "Raw Materials",
      "description": "High purity aluminium ingot",
      "uom": "KG",
      "hsn_code": "760711",
      "gst_rate": 18,
      "is_active": true,
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Get Item Groups
```http
GET /items/groups
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    "Raw Materials",
    "Components",
    "Services",
    "Tools & Equipment"
  ]
}
```

---

### Get Item Details
```http
GET /items/ITEM001
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "item_code": "ITEM001",
    "name": "Aluminium Ingot A380",
    "item_group": "Raw Materials",
    "description": "High purity aluminium ingot",
    "uom": "KG",
    "hsn_code": "760711",
    "gst_rate": 18,
    "is_active": true,
    "stock": [
      {
        "warehouse_code": "WH001",
        "qty_on_hand": 500,
        "qty_available": 450,
        "qty_reserved": 50
      }
    ]
  }
}
```

---

### Get Item Stock
```http
GET /items/ITEM001/stock
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalStock": {
      "total_qty": 1000,
      "available_qty": 950,
      "reserved_qty": 50
    },
    "stockByWarehouse": [
      {
        "warehouse_code": "WH001",
        "qty_on_hand": 500,
        "qty_available": 450,
        "qty_reserved": 50
      },
      {
        "warehouse_code": "WH002",
        "qty_on_hand": 500,
        "qty_available": 500,
        "qty_reserved": 0
      }
    ]
  }
}
```

---

### Update Item
```http
PUT /items/ITEM001
Content-Type: application/json

{
  "gst_rate": 18,
  "is_active": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "affectedRows": 1
  }
}
```

---

### Delete Item (Soft Delete)
```http
DELETE /items/ITEM001
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

## Purchase Receipts (GRN)

### Create GRN
```http
POST /purchase-receipts
Content-Type: application/json

{
  "po_no": "PO-1704024600000",
  "supplier_id": "SUP001",
  "receipt_date": "2025-01-20",
  "created_by_id": "CONT001",
  "items": [
    {
      "item_code": "ITEM001",
      "received_qty": 100,
      "accepted_qty": 100,
      "warehouse_code": "WH001",
      "batch_no": "BATCH001",
      "quality_inspection_required": true
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "grn_no": "GRN-1704024600000",
    "status": "created"
  }
}
```

---

### List GRNs
```http
GET /purchase-receipts?supplier_id=SUP001&status=accepted&po_no=PO-1704024600000
```

**Query Parameters**:
- `supplier_id` (optional) - Filter by supplier
- `status` (optional) - draft, submitted, inspected, accepted, rejected
- `po_no` (optional) - Filter by PO number
- `limit` (optional) - Records per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "grn_no": "GRN-1704024600000",
      "po_no": "PO-1704024600000",
      "supplier_id": "SUP001",
      "supplier_name": "ABC Aluminium Ltd.",
      "receipt_date": "2025-01-20",
      "status": "accepted",
      "item_count": 2,
      "created_at": "2025-01-20T10:30:00.000Z"
    }
  ]
}
```

---

### Get GRN Details
```http
GET /purchase-receipts/GRN-1704024600000
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "grn_no": "GRN-1704024600000",
    "po_no": "PO-1704024600000",
    "supplier_id": "SUP001",
    "supplier_name": "ABC Aluminium Ltd.",
    "receipt_date": "2025-01-20",
    "status": "accepted",
    "items": [
      {
        "grn_item_id": "uuid",
        "item_code": "ITEM001",
        "item_name": "Aluminium Ingot A380",
        "received_qty": 100,
        "accepted_qty": 100,
        "rejected_qty": 0,
        "warehouse_code": "WH001",
        "batch_no": "BATCH001",
        "quality_inspection_required": false
      }
    ]
  }
}
```

---

### Update GRN Item
```http
PUT /purchase-receipts/GRN-1704024600000/items/grn_item_id
Content-Type: application/json

{
  "accepted_qty": 95,
  "rejected_qty": 5
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "affectedRows": 1
  }
}
```

---

### Accept GRN
```http
POST /purchase-receipts/GRN-1704024600000/accept
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true,
    "items_processed": 2
  }
}
```

This updates stock and marks GRN as accepted.

---

### Reject GRN
```http
POST /purchase-receipts/GRN-1704024600000/reject
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

### Delete GRN
```http
DELETE /purchase-receipts/GRN-1704024600000
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

## Purchase Invoices

### Create Invoice
```http
POST /purchase-invoices
Content-Type: application/json

{
  "supplier_id": "SUP001",
  "po_no": "PO-1704024600000",
  "grn_no": "GRN-1704024600000",
  "invoice_date": "2025-01-20",
  "due_date": "2025-02-04",
  "tax_template_id": "TAX001",
  "created_by_id": "CONT001",
  "items": [
    {
      "item_code": "ITEM001",
      "qty": 100,
      "rate": 1500
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "purchase_invoice_no": "INV-1704024600000",
    "status": "created"
  }
}
```

---

### List Invoices
```http
GET /purchase-invoices?supplier_id=SUP001&status=paid&invoice_date_from=2025-01-01&invoice_date_to=2025-01-31
```

**Query Parameters**:
- `supplier_id` (optional) - Filter by supplier
- `status` (optional) - draft, submitted, paid, cancelled
- `invoice_date_from` (optional) - Start date (YYYY-MM-DD)
- `invoice_date_to` (optional) - End date (YYYY-MM-DD)
- `limit` (optional) - Records per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "purchase_invoice_no": "INV-1704024600000",
      "supplier_id": "SUP001",
      "supplier_name": "ABC Aluminium Ltd.",
      "invoice_date": "2025-01-20",
      "due_date": "2025-02-04",
      "net_amount": 180000,
      "status": "paid",
      "item_count": 1,
      "created_at": "2025-01-20T10:30:00.000Z"
    }
  ]
}
```

---

### Get Invoice Details
```http
GET /purchase-invoices/INV-1704024600000
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "purchase_invoice_no": "INV-1704024600000",
    "supplier_id": "SUP001",
    "supplier_name": "ABC Aluminium Ltd.",
    "gstin": "AAAAT1234F",
    "po_no": "PO-1704024600000",
    "grn_no": "GRN-1704024600000",
    "invoice_date": "2025-01-20",
    "due_date": "2025-02-04",
    "net_amount": 180000,
    "taxes_amount": 30000,
    "status": "paid",
    "items": [
      {
        "invoice_item_id": "uuid",
        "item_code": "ITEM001",
        "item_name": "Aluminium Ingot A380",
        "qty": 100,
        "rate": 1500
      }
    ]
  }
}
```

---

### Submit Invoice
```http
POST /purchase-invoices/INV-1704024600000/submit
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true,
    "net_amount": 180000
  }
}
```

---

### Mark Invoice as Paid
```http
POST /purchase-invoices/INV-1704024600000/mark-paid
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

### Delete Invoice
```http
DELETE /purchase-invoices/INV-1704024600000
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

## Suppliers

### List Suppliers
```http
GET /suppliers?limit=50&offset=0
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "supplier_id": "SUP001",
      "name": "ABC Aluminium Ltd.",
      "supplier_group": "Raw Materials",
      "gstin": "AAAAT1234F",
      "contact_person_id": "CONT001",
      "payment_terms_days": 30,
      "lead_time_days": 7,
      "rating": 4.5,
      "is_active": true,
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid input data or missing required fields"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Purchase Order not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource not found |
| 500 | Server Error - Internal error |

---

## Tips & Best Practices

1. **Always include Content-Type header** for POST/PUT requests
2. **Use pagination** for large datasets
3. **Check status workflows** before operations
4. **Validate data** before sending
5. **Handle errors** appropriately in client
6. **Use timestamps** for filtering
7. **Sort by created_at DESC** for latest records

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-15  
**API Status**: ✅ Fully Functional