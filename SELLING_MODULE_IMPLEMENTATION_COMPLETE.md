# 🛒 SELLING MODULE - COMPLETE IMPLEMENTATION GUIDE

**Status:** Ready to implement  
**Complexity:** Medium  
**Estimated Time:** 3-4 hours  
**Prerequisites:** Running MySQL, Node.js backend, React frontend  

---

## 📋 TABLE OF CONTENTS

1. [Database Schema](#database-schema)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Testing Guide](#testing-guide)

---

## 1️⃣ DATABASE SCHEMA

### Step 1: Create Selling Schema SQL File

**File:** `c:\repo\backend\scripts\selling_schema.sql`

This file will contain all necessary tables for the Selling module.

**Tables to create:**
1. customer - Customer master
2. customer_group - Customer categorization
3. customer_contact - Customer contacts (links to contact table)
4. customer_address - Customer addresses (links to address table)
5. sales_quotation - Sales quotation header
6. sales_quotation_item - Sales quotation line items
7. sales_order - Sales order header
8. sales_order_item - Sales order line items
9. delivery_note - Delivery note header
10. delivery_note_item - Delivery note line items
11. sales_invoice - Sales invoice header
12. sales_invoice_item - Sales invoice line items

---

## 2️⃣ BACKEND IMPLEMENTATION

### Structure Overview

```
backend/src/
├── models/
│   ├── CustomerModel.js (NEW)
│   ├── SalesQuotationModel.js (NEW)
│   ├── SalesOrderModel.js (NEW)
│   ├── DeliveryNoteModel.js (NEW)
│   └── SalesInvoiceModel.js (NEW)
├── controllers/
│   ├── CustomerController.js (NEW)
│   ├── SalesQuotationController.js (NEW)
│   ├── SalesOrderController.js (NEW)
│   ├── DeliveryNoteController.js (NEW)
│   └── SalesInvoiceController.js (NEW)
├── routes/
│   ├── customers.js (NEW)
│   ├── salesQuotations.js (NEW)
│   ├── salesOrders.js (NEW)
│   ├── deliveryNotes.js (NEW)
│   └── salesInvoices.js (NEW)
└── app.js (MODIFIED - add route registrations)
```

### API Endpoint Naming Convention

Following the existing Buying module pattern:

```
✅ /api/selling/customers              - Customer CRUD
✅ /api/selling/quotations             - Sales Quotation CRUD
✅ /api/selling/sales-orders           - Sales Order CRUD
✅ /api/selling/delivery-notes         - Delivery Note CRUD
✅ /api/selling/sales-invoices         - Sales Invoice CRUD
```

---

## 3️⃣ FRONTEND IMPLEMENTATION

### Structure Overview

```
frontend/src/pages/Selling/
├── Customers.jsx (UPDATE - add create form)
├── CustomerForm.jsx (NEW)
├── Quotation.jsx (UPDATE - add create form)
├── SalesQuotationForm.jsx (NEW)
├── SalesOrder.jsx (UPDATE - add create form)
├── SalesOrderForm.jsx (NEW)
├── DeliveryNote.jsx (UPDATE - add create form)
├── DeliveryNoteForm.jsx (NEW)
├── SalesInvoice.jsx (UPDATE - add create form)
├── SalesInvoiceForm.jsx (NEW)
└── index.js (UPDATE - export new components)
```

---

## 4️⃣ API ENDPOINTS REFERENCE

### A. CUSTOMER MANAGEMENT

#### Create Customer
```
POST /api/selling/customers
Content-Type: application/json

Request Body:
{
  "name": "Acme Corporation",
  "customer_group": "Large Accounts",
  "email": "contact@acme.com",
  "phone": "9876543210",
  "gstin": "18AABCT1234A1Z5",
  "credit_limit": 100000,
  "payment_terms_days": 45
}

Response (201):
{
  "success": true,
  "data": {
    "customer_id": "CUST-001",
    "name": "Acme Corporation",
    "status": "active",
    "created_at": "2024-01-20T10:00:00Z"
  }
}
```

#### Get All Customers
```
GET /api/selling/customers
GET /api/selling/customers?search=acme&status=active&group=Large

Response (200):
{
  "success": true,
  "data": [
    {
      "customer_id": "CUST-001",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "credit_limit": 100000,
      "is_active": true
    }
  ]
}
```

#### Get Customer by ID
```
GET /api/selling/customers/:id

Response (200):
{
  "success": true,
  "data": {
    "customer_id": "CUST-001",
    "name": "Acme Corporation",
    "email": "contact@acme.com",
    "phone": "9876543210",
    "gstin": "18AABCT1234A1Z5",
    "credit_limit": 100000,
    "payment_terms_days": 45,
    "is_active": true,
    "created_at": "2024-01-20T10:00:00Z",
    "contacts": [],
    "addresses": []
  }
}
```

#### Update Customer
```
PUT /api/selling/customers/:id
Content-Type: application/json

Request Body:
{
  "name": "Acme Corporation Ltd",
  "credit_limit": 150000,
  "payment_terms_days": 60
}

Response (200):
{
  "success": true,
  "data": { ... }
}
```

#### Deactivate Customer
```
PATCH /api/selling/customers/:id/deactivate

Response (200):
{
  "success": true,
  "message": "Customer deactivated"
}
```

#### Delete Customer
```
DELETE /api/selling/customers/:id

Response (200):
{
  "success": true,
  "message": "Customer deleted"
}
```

---

### B. SALES QUOTATION

#### Create Sales Quotation
```
POST /api/selling/quotations
Content-Type: application/json

Request Body:
{
  "customer_id": "CUST-001",
  "quotation_date": "2024-01-20",
  "valid_till": "2024-02-20",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 500,
      "uom": "kg",
      "rate": 250
    },
    {
      "item_code": "ITEM-002",
      "qty": 100,
      "uom": "boxes",
      "rate": 1000
    }
  ]
}

Response (201):
{
  "success": true,
  "data": {
    "sales_quotation_id": "SQ-2024-001",
    "customer_id": "CUST-001",
    "total_value": 225000,
    "status": "draft",
    "items": [ ... ]
  }
}
```

#### Get All Quotations
```
GET /api/selling/quotations
GET /api/selling/quotations?status=sent&customer=CUST-001

Response (200):
{
  "success": true,
  "data": [
    {
      "sales_quotation_id": "SQ-2024-001",
      "customer_name": "Acme Corporation",
      "total_value": 225000,
      "status": "draft",
      "quotation_date": "2024-01-20"
    }
  ]
}
```

#### Send Quotation to Customer
```
PATCH /api/selling/quotations/:id/send

Response (200):
{
  "success": true,
  "data": {
    "sales_quotation_id": "SQ-2024-001",
    "status": "sent",
    "sent_date": "2024-01-20T10:30:00Z"
  }
}
```

#### Convert Quotation to Sales Order
```
PATCH /api/selling/quotations/:id/convert-to-order

Response (201):
{
  "success": true,
  "data": {
    "sales_quotation_id": "SQ-2024-001",
    "status": "converted",
    "sales_order_no": "SO-2024-001"
  }
}
```

---

### C. SALES ORDER

#### Create Sales Order
```
POST /api/selling/sales-orders
Content-Type: application/json

Request Body:
{
  "customer_id": "CUST-001",
  "order_date": "2024-01-21",
  "expected_delivery_date": "2024-01-28",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 500,
      "uom": "kg",
      "rate": 250
    }
  ]
}

Response (201):
{
  "success": true,
  "data": {
    "sales_order_no": "SO-2024-001",
    "customer_id": "CUST-001",
    "total_value": 125000,
    "status": "draft",
    "items": [ ... ]
  }
}
```

#### Get All Sales Orders
```
GET /api/selling/sales-orders
GET /api/selling/sales-orders?status=confirmed&customer=CUST-001

Response (200):
{
  "success": true,
  "data": [
    {
      "sales_order_no": "SO-2024-001",
      "customer_name": "Acme Corporation",
      "total_value": 125000,
      "status": "draft",
      "order_date": "2024-01-21"
    }
  ]
}
```

#### Confirm Sales Order
```
PATCH /api/selling/sales-orders/:id/confirm

Response (200):
{
  "success": true,
  "data": {
    "sales_order_no": "SO-2024-001",
    "status": "confirmed"
  }
}
```

#### Create Delivery Note from Sales Order
```
PATCH /api/selling/sales-orders/:id/create-delivery-note

Request Body (optional):
{
  "items": [
    { "item_code": "ITEM-001", "qty": 500 }
  ]
}

Response (201):
{
  "success": true,
  "data": {
    "sales_order_no": "SO-2024-001",
    "delivery_note_no": "DN-2024-001"
  }
}
```

---

### D. DELIVERY NOTE

#### Create Delivery Note
```
POST /api/selling/delivery-notes
Content-Type: application/json

Request Body:
{
  "sales_order_no": "SO-2024-001",
  "customer_id": "CUST-001",
  "delivery_date": "2024-01-28",
  "items": [
    {
      "item_code": "ITEM-001",
      "delivered_qty": 500,
      "uom": "kg"
    }
  ]
}

Response (201):
{
  "success": true,
  "data": {
    "delivery_note_no": "DN-2024-001",
    "sales_order_no": "SO-2024-001",
    "total_delivered_qty": 500,
    "status": "draft",
    "items": [ ... ]
  }
}
```

#### Get All Delivery Notes
```
GET /api/selling/delivery-notes
GET /api/selling/delivery-notes?status=dispatched

Response (200):
{
  "success": true,
  "data": [ ... ]
}
```

#### Mark as Dispatched
```
PATCH /api/selling/delivery-notes/:id/dispatch

Response (200):
{
  "success": true,
  "data": {
    "delivery_note_no": "DN-2024-001",
    "status": "dispatched"
  }
}
```

---

### E. SALES INVOICE

#### Create Sales Invoice
```
POST /api/selling/sales-invoices
Content-Type: application/json

Request Body:
{
  "customer_id": "CUST-001",
  "sales_order_no": "SO-2024-001",
  "invoice_date": "2024-01-29",
  "due_date": "2024-03-14",
  "tax_template_id": "TAX-001",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 500,
      "rate": 250
    }
  ]
}

Response (201):
{
  "success": true,
  "data": {
    "sales_invoice_no": "SI-2024-001",
    "customer_id": "CUST-001",
    "total_value": 125000,
    "taxes_amount": 22500,
    "net_amount": 147500,
    "status": "draft"
  }
}
```

#### Get All Sales Invoices
```
GET /api/selling/sales-invoices
GET /api/selling/sales-invoices?status=paid&customer=CUST-001

Response (200):
{
  "success": true,
  "data": [ ... ]
}
```

#### Mark Invoice as Paid
```
PATCH /api/selling/sales-invoices/:id/mark-paid

Request Body:
{
  "paid_amount": 147500,
  "payment_date": "2024-02-10"
}

Response (200):
{
  "success": true,
  "data": {
    "sales_invoice_no": "SI-2024-001",
    "status": "paid"
  }
}
```

---

## 5️⃣ TESTING GUIDE

### Prerequisites
- MySQL running with database created
- Backend server running on port 5000
- API testing tool: Postman, Insomnia, or cURL

### Test Sequence

#### 1. Create Customer
```bash
curl -X POST http://localhost:5000/api/selling/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "email": "test@example.com",
    "credit_limit": 50000
  }'
```

Expected Response: 201 with customer_id

#### 2. Get All Customers
```bash
curl http://localhost:5000/api/selling/customers
```

Expected Response: 200 with array of customers

#### 3. Create Sales Quotation
```bash
curl -X POST http://localhost:5000/api/selling/quotations \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-001",
    "quotation_date": "2024-01-20",
    "valid_till": "2024-02-20",
    "items": [
      {
        "item_code": "ITEM-001",
        "qty": 100,
        "rate": 500
      }
    ]
  }'
```

Expected Response: 201 with quotation details

#### 4. Create Sales Order
```bash
curl -X POST http://localhost:5000/api/selling/sales-orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-001",
    "order_date": "2024-01-21",
    "expected_delivery_date": "2024-01-28",
    "items": [
      {
        "item_code": "ITEM-001",
        "qty": 100,
        "rate": 500
      }
    ]
  }'
```

Expected Response: 201 with sales order details

#### 5. Create Delivery Note
```bash
curl -X POST http://localhost:5000/api/selling/delivery-notes \
  -H "Content-Type: application/json" \
  -d '{
    "sales_order_no": "SO-2024-001",
    "customer_id": "CUST-001",
    "delivery_date": "2024-01-28",
    "items": [
      {
        "item_code": "ITEM-001",
        "delivered_qty": 100
      }
    ]
  }'
```

Expected Response: 201 with delivery note details

#### 6. Create Sales Invoice
```bash
curl -X POST http://localhost:5000/api/selling/sales-invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST-001",
    "sales_order_no": "SO-2024-001",
    "invoice_date": "2024-01-29",
    "due_date": "2024-03-14",
    "items": [
      {
        "item_code": "ITEM-001",
        "qty": 100,
        "rate": 500
      }
    ]
  }'
```

Expected Response: 201 with invoice details

---

## 📋 IMPLEMENTATION CHECKLIST

### Database
- [ ] Create selling_schema.sql with all 12 tables
- [ ] Run migration script to create tables
- [ ] Verify tables exist in MySQL

### Backend Models
- [ ] Create CustomerModel.js
- [ ] Create SalesQuotationModel.js
- [ ] Create SalesOrderModel.js
- [ ] Create DeliveryNoteModel.js
- [ ] Create SalesInvoiceModel.js

### Backend Controllers
- [ ] Create CustomerController.js
- [ ] Create SalesQuotationController.js
- [ ] Create SalesOrderController.js
- [ ] Create DeliveryNoteController.js
- [ ] Create SalesInvoiceController.js

### Backend Routes
- [ ] Create customers.js
- [ ] Create salesQuotations.js
- [ ] Create salesOrders.js
- [ ] Create deliveryNotes.js
- [ ] Create salesInvoices.js
- [ ] Register all routes in app.js

### Frontend Forms
- [ ] Create CustomerForm.jsx
- [ ] Create SalesQuotationForm.jsx
- [ ] Create SalesOrderForm.jsx
- [ ] Create DeliveryNoteForm.jsx
- [ ] Create SalesInvoiceForm.jsx

### Frontend List Pages
- [ ] Update Customers.jsx to use API
- [ ] Update Quotation.jsx to use API
- [ ] Update SalesOrder.jsx to use API
- [ ] Update DeliveryNote.jsx to use API
- [ ] Update SalesInvoice.jsx to use API

### Testing
- [ ] Test all create APIs with Postman
- [ ] Test all list APIs
- [ ] Test frontend forms
- [ ] Test navigation and workflows
- [ ] Test error handling

---

## 🚀 QUICK START COMMAND

Ready to implement? Start with:

```bash
# 1. Backend routes registration
# 2. Database tables creation
# 3. Models implementation
# 4. Controllers implementation
# 5. Frontend forms
# 6. Testing
```

**Estimated Time:** 3-4 hours for complete implementation

---

## 📞 COMMON ISSUES & SOLUTIONS

### Issue: 404 Not Found on /api/selling/customers
**Solution:** Routes not registered in app.js. Check app.js imports and setupRoutes() function.

### Issue: Column 'customer_id' doesn't exist
**Solution:** Database tables not created. Run selling_schema.sql migration.

### Issue: Frontend form not submitting
**Solution:** Check API endpoint URL and request body format. Use browser DevTools → Network tab.

### Issue: Foreign key constraint fails
**Solution:** Ensure referenced records (items, tax templates) exist in database before creating related records.

### Issue: CORS errors
**Solution:** Verify CORS_ORIGIN in .env includes frontend URL (http://localhost:5173).

---

**Next Step:** Ready to begin implementation? I can create all files and register them. Just say the word! 🚀