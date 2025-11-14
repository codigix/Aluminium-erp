# Selling Module - Backend API Specification

## 📋 Overview

This document specifies all API endpoints required for the Selling Module frontend. These endpoints must be implemented in the backend to support the frontend pages and workflows.

## 🔐 Authentication

All endpoints require:
- **Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Content-Type**: `application/json`

## 📌 Base URL

```
http://localhost:5000/api/selling
```

---

# 🎯 API Endpoints

## 1️⃣ QUOTATIONS

### List All Quotations
```
GET /api/selling/quotations?status=&customer=&search=
```

**Query Parameters**:
- `status` (optional): Filter by status (draft, sent, accepted, converted, cancelled)
- `customer` (optional): Filter by customer name/ID
- `search` (optional): Search by quote ID or customer name

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "quote_id": "QT-2024-001",
      "customer_id": 5,
      "customer_name": "ABC Corp",
      "valid_till": "2024-12-31",
      "total_value": 100000,
      "status": "sent",
      "items": [
        {
          "id": 1,
          "item_code": "ITEM-001",
          "description": "Aluminum Casting",
          "qty": 100,
          "rate": 1000,
          "tax": 18,
          "amount": 118000
        }
      ],
      "created_at": "2024-11-03T10:00:00Z",
      "updated_at": "2024-11-03T10:00:00Z"
    }
  ]
}
```

### Get Single Quotation
```
GET /api/selling/quotations/:id
```

**Response**: Returns single quotation object (same structure as above)

### Create Quotation
```
POST /api/selling/quotations
```

**Request Body**:
```json
{
  "customer_id": 5,
  "valid_till": "2024-12-31",
  "delivery_terms": "FOB",
  "payment_terms": "Net 30",
  "items": [
    {
      "item_code": "ITEM-001",
      "description": "Aluminum Casting",
      "qty": 100,
      "rate": 1000,
      "tax_percent": 18
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "quote_id": "QT-2024-001",
    "customer_id": 5,
    "status": "draft",
    "message": "Quotation created successfully"
  }
}
```

### Update Quotation
```
PUT /api/selling/quotations/:id
```

**Request Body**: Same as Create (only draft quotations can be updated)

**Response**:
```json
{
  "success": true,
  "data": { "id": 1, "message": "Quotation updated successfully" }
}
```

### Send Quotation
```
PUT /api/selling/quotations/:id/send
```

**Request Body**: Empty

**Logic**:
- Update status from "draft" to "sent"
- Send email to customer (optional notification)
- Update timestamp

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "sent",
    "message": "Quotation sent to customer"
  }
}
```

### Delete Quotation
```
DELETE /api/selling/quotations/:id
```

**Response**:
```json
{
  "success": true,
  "data": { "message": "Quotation deleted successfully" }
}
```

---

## 2️⃣ SALES ORDERS

### List All Sales Orders
```
GET /api/selling/sales-orders?status=&customer=&search=
```

**Query Parameters**:
- `status` (optional): draft, confirmed, dispatched, invoiced, cancelled
- `customer` (optional): Filter by customer
- `search` (optional): Search by order ID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_id": "SO-2024-001",
      "quotation_id": 1,
      "customer_id": 5,
      "customer_name": "ABC Corp",
      "order_date": "2024-11-03",
      "delivery_date": "2024-11-15",
      "total_value": 100000,
      "status": "confirmed",
      "items": [
        {
          "id": 1,
          "item_code": "ITEM-001",
          "description": "Aluminum Casting",
          "qty": 100,
          "rate": 1000,
          "amount": 100000
        }
      ],
      "created_at": "2024-11-03T10:00:00Z",
      "updated_at": "2024-11-03T10:00:00Z"
    }
  ]
}
```

### Get Single Sales Order
```
GET /api/selling/sales-orders/:id
```

### Create Sales Order
```
POST /api/selling/sales-orders
```

**Request Body**:
```json
{
  "customer_id": 5,
  "quotation_id": 1,  // optional - if converting from quotation
  "order_date": "2024-11-03",
  "delivery_date": "2024-11-15",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 100,
      "rate": 1000
    }
  ]
}
```

### Update Sales Order
```
PUT /api/selling/sales-orders/:id
```

**Constraint**: Only draft orders can be updated

### Confirm Sales Order
```
PUT /api/selling/sales-orders/:id/confirm
```

**Logic**:
1. Validate stock availability for each item
2. Check customer credit limit vs outstanding balance
3. Update status to "confirmed"
4. Trigger Material Issue creation if stock is low
5. Create draft Delivery Note (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "confirmed",
    "stock_status": {
      "available": true,
      "items": [
        {
          "item_code": "ITEM-001",
          "required": 100,
          "in_stock": 150,
          "status": "available"
        }
      ]
    },
    "credit_check": {
      "credit_limit": 500000,
      "outstanding": 100000,
      "available": 400000,
      "order_value": 100000,
      "status": "approved"
    }
  }
}
```

### Delete Sales Order
```
DELETE /api/selling/sales-orders/:id
```

---

## 3️⃣ DELIVERY NOTES

### List All Delivery Notes
```
GET /api/selling/delivery-notes?status=&customer=&search=
```

**Query Parameters**:
- `status`: draft, submitted, delivered, partially_delivered, cancelled
- `customer`: Filter by customer
- `search`: Search by delivery ID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "delivery_id": "DN-2024-001",
      "customer_id": 5,
      "customer_name": "ABC Corp",
      "delivery_date": "2024-11-15",
      "total_qty": 100,
      "total_value": 100000,
      "status": "submitted",
      "vehicle_details": {
        "vehicle_no": "KA-01-AB-1234",
        "transporter": "XYZ Logistics",
        "dispatch_location": "Warehouse-A",
        "gate_pass_no": "GP-001"
      },
      "linked_orders": [
        {
          "order_id": "SO-2024-001",
          "qty": 100
        }
      ],
      "items": [
        {
          "id": 1,
          "item_code": "ITEM-001",
          "description": "Aluminum Casting",
          "qty_ordered": 100,
          "qty_delivered": 100
        }
      ],
      "created_at": "2024-11-03T10:00:00Z",
      "updated_at": "2024-11-15T10:00:00Z"
    }
  ]
}
```

### Get Single Delivery Note
```
GET /api/selling/delivery-notes/:id
```

### Create Delivery Note
```
POST /api/selling/delivery-notes
```

**Request Body**:
```json
{
  "customer_id": 5,
  "sales_order_ids": [1],  // can be multiple
  "delivery_date": "2024-11-15",
  "vehicle_no": "KA-01-AB-1234",
  "transporter": "XYZ Logistics",
  "dispatch_location": "Warehouse-A",
  "gate_pass_no": "GP-001",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 100
    }
  ]
}
```

### Update Delivery Note
```
PUT /api/selling/delivery-notes/:id
```

**Constraint**: Only draft notes can be updated

### Submit Delivery Note
```
PUT /api/selling/delivery-notes/:id/submit
```

**Logic**:
1. Validate all quantities are available in warehouse
2. Reduce warehouse stock for each item (by qty)
3. Update status to "submitted"
4. Create auto-draft Sales Invoice (optional)
5. Update linked Sales Orders

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "submitted",
    "stock_reduced": [
      {
        "item_code": "ITEM-001",
        "qty_reduced": 100
      }
    ],
    "invoice_draft": {
      "id": 1,
      "invoice_id": "INV-2024-001",
      "status": "draft"
    }
  }
}
```

### Delete Delivery Note
```
DELETE /api/selling/delivery-notes/:id
```

**Note**: Only delete draft notes to avoid stock discrepancies

---

## 4️⃣ SALES INVOICES

### List All Sales Invoices
```
GET /api/selling/sales-invoices?status=&payment_status=&customer=&search=
```

**Query Parameters**:
- `status`: draft, submitted, paid, cancelled
- `payment_status`: unpaid, partially_paid, paid
- `customer`: Filter by customer
- `search`: Search by invoice ID

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_id": "INV-2024-001",
      "customer_id": 5,
      "customer_name": "ABC Corp",
      "invoice_date": "2024-11-15",
      "due_date": "2024-12-15",
      "items": [
        {
          "id": 1,
          "item_code": "ITEM-001",
          "description": "Aluminum Casting",
          "qty": 100,
          "rate": 1000,
          "tax_percent": 18,
          "line_total": 118000
        }
      ],
      "subtotal": 100000,
      "tax_amount": 18000,
      "total_value": 118000,
      "amount_paid": 0,
      "outstanding": 118000,
      "status": "submitted",
      "payment_status": "unpaid",
      "payment_terms": "Net 30",
      "notes": "Please pay by due date",
      "created_at": "2024-11-15T10:00:00Z",
      "updated_at": "2024-11-15T10:00:00Z"
    }
  ]
}
```

### Get Single Sales Invoice
```
GET /api/selling/sales-invoices/:id
```

### Create Sales Invoice
```
POST /api/selling/sales-invoices
```

**Request Body**:
```json
{
  "customer_id": 5,
  "delivery_note_id": 1,  // optional - auto-fetch details
  "sales_order_id": 1,     // optional - if not from delivery note
  "invoice_date": "2024-11-15",
  "due_date": "2024-12-15",
  "items": [
    {
      "item_code": "ITEM-001",
      "description": "Aluminum Casting",
      "qty": 100,
      "rate": 1000,
      "tax_percent": 18
    }
  ],
  "payment_terms": "Net 30",
  "notes": "Please pay by due date"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoice_id": "INV-2024-001",
    "status": "draft",
    "total_value": 118000
  }
}
```

### Update Sales Invoice
```
PUT /api/selling/sales-invoices/:id
```

**Constraint**: Only draft invoices can be updated

### Submit Sales Invoice
```
PUT /api/selling/sales-invoices/:id/submit
```

**Logic**:
1. Final calculation of taxes
2. Update status to "submitted"
3. Send email to customer (optional)
4. Create accounting entries in Accounts module
5. Create entry for ledger

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "submitted",
    "payment_status": "unpaid"
  }
}
```

### Record Payment
```
PUT /api/selling/sales-invoices/:id/payment
```

**Request Body**:
```json
{
  "amount": 59000,
  "payment_date": "2024-11-20",
  "payment_method": "bank_transfer",
  "reference_no": "TXN-12345"
}
```

**Logic**:
1. Add payment to amount_paid
2. Calculate outstanding (total - amount_paid)
3. Update payment_status:
   - If amount_paid == 0: "unpaid"
   - If 0 < amount_paid < total: "partially_paid"
   - If amount_paid >= total: "paid"
4. Create payment entry in Accounts module

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "amount_paid": 59000,
    "outstanding": 59000,
    "payment_status": "partially_paid"
  }
}
```

### Delete Sales Invoice
```
DELETE /api/selling/sales-invoices/:id
```

---

## 5️⃣ CUSTOMERS

### List All Customers
```
GET /api/selling/customers?status=&search=
```

**Query Parameters**:
- `status`: active, inactive
- `search`: Customer name or email

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "ABC Corp",
      "email": "sales@abccorp.com",
      "phone": "+91-9876543210",
      "gst_no": "27AABCU1234H1Z0",
      "credit_limit": 500000,
      "outstanding_balance": 100000,
      "total_sales": 500000,
      "status": "active",
      "customer_group": "OEM",
      "billing_address": {
        "address": "123 Main St",
        "city": "Bangalore",
        "state": "KA",
        "postal_code": "560001"
      },
      "shipping_address": {
        "address": "456 Factory Rd",
        "city": "Bangalore",
        "state": "KA",
        "postal_code": "560002"
      },
      "contacts": [
        {
          "name": "John Doe",
          "email": "john@abccorp.com",
          "phone": "+91-9876543211"
        }
      ],
      "payment_terms": "Net 30",
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-11-03T10:00:00Z"
    }
  ]
}
```

### Get Single Customer
```
GET /api/selling/customers/:id
```

### Create Customer
```
POST /api/selling/customers
```

**Request Body**:
```json
{
  "name": "ABC Corp",
  "email": "sales@abccorp.com",
  "phone": "+91-9876543210",
  "gst_no": "27AABCU1234H1Z0",
  "credit_limit": 500000,
  "customer_group": "OEM",
  "billing_address": {
    "address": "123 Main St",
    "city": "Bangalore",
    "state": "KA",
    "postal_code": "560001"
  },
  "shipping_address": {
    "address": "456 Factory Rd",
    "city": "Bangalore",
    "state": "KA",
    "postal_code": "560002"
  },
  "payment_terms": "Net 30"
}
```

### Update Customer
```
PUT /api/selling/customers/:id
```

### Delete Customer
```
DELETE /api/selling/customers/:id
```

**Logic**: Only delete if no orders linked

---

## 📊 ANALYTICS

### Get Selling Analytics
```
GET /api/selling/analytics?period=monthly
```

**Query Parameters**:
- `period`: weekly, monthly, quarterly, yearly

**Response**:
```json
{
  "success": true,
  "data": {
    "totalSales": 1000000,
    "totalOrders": 15,
    "averageOrderValue": 66666.67,
    "conversionRate": 85.5,
    "topCustomer": {
      "name": "ABC Corp",
      "value": 250000
    },
    "topProduct": {
      "name": "Aluminum Casting",
      "value": 5000
    },
    "monthlyTrend": [
      {
        "month": "October",
        "sales": 500000,
        "orders": 8
      },
      {
        "month": "November",
        "sales": 500000,
        "orders": 7
      }
    ],
    "statusBreakdown": [
      {
        "name": "Draft",
        "count": 2,
        "color": "warning"
      },
      {
        "name": "Confirmed",
        "count": 5,
        "color": "info"
      },
      {
        "name": "Delivered",
        "count": 8,
        "color": "success"
      }
    ],
    "paymentStatus": [
      {
        "name": "Paid",
        "value": 800000,
        "percentage": 80
      },
      {
        "name": "Unpaid",
        "value": 200000,
        "percentage": 20
      }
    ]
  }
}
```

### Export Analytics
```
GET /api/selling/analytics/export?period=monthly
```

**Response**: Excel file (.xlsx)

---

## 🔄 Key Validations

### Stock Validation
- When confirming sales order
- When submitting delivery note
- Check against warehouse inventory
- Prevent over-delivery

### Credit Limit Validation
- When confirming sales order
- Compare: Outstanding Balance + Order Value ≤ Credit Limit
- Prevent over-credit sales

### Tax Calculations
- Auto-calculate GST (18% typical, may vary)
- Apply TDS if applicable
- Consider tax exemptions for certain items

### Status Transitions
- Quotation: Draft → Sent → Accepted → Converted
- Sales Order: Draft → Confirmed → Dispatched → Invoiced
- Delivery Note: Draft → Submitted → Delivered
- Invoice: Draft → Submitted → Paid

---

## 📝 Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
```
INVALID_CUSTOMER: Customer not found
STOCK_UNAVAILABLE: Insufficient stock
CREDIT_LIMIT_EXCEEDED: Order exceeds credit limit
INVALID_STATUS: Invalid status transition
INVALID_ITEM: Item not found
DUPLICATE_ENTRY: Duplicate quotation/order
UNAUTHORIZED: User not authorized
```

---

## 🔐 Permission Checks

Each endpoint should verify:
1. User is authenticated (JWT token valid)
2. User has required role (Sales, Store Manager, Accounts, etc.)
3. User can access this module

---

## 📊 Performance Requirements

- List endpoints should support pagination (limit, offset)
- Response time < 1 second for list endpoints
- Response time < 500ms for single record fetch
- Bulk operations should be supported

---

## 🔔 Notifications (Optional)

Send notifications on:
- Quotation sent to customer
- Sales order confirmed
- Delivery note submitted
- Invoice submitted
- Payment received
- Overdue invoice

---

## 📚 Implementation Priority

**Phase 1 (High Priority)**:
1. Quotation CRUD + Send
2. Sales Order CRUD + Confirm
3. Delivery Note CRUD + Submit
4. Sales Invoice CRUD + Submit + Payment
5. Customers CRUD

**Phase 2 (Medium Priority)**:
1. Stock validation during confirm
2. Credit limit validation
3. Tax calculations
4. Analytics endpoints

**Phase 3 (Low Priority)**:
1. Email notifications
2. Payment reminders
3. Complex reports
4. Data export

---

## ✅ Testing Checklist

- [ ] All CRUD operations work
- [ ] Status transitions are enforced
- [ ] Stock is correctly reduced
- [ ] Credit limits are validated
- [ ] Taxes are calculated correctly
- [ ] Payments are tracked
- [ ] Analytics aggregations are accurate
- [ ] Error messages are descriptive
- [ ] Response times meet requirements

---

This API specification is ready for backend implementation!