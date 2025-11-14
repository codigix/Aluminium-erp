# API Documentation

Base URL: \http://localhost:5000/api\

## Health Check

### GET /health

Check if the API server is running.

**Response:**
\\\json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z"
}
\\\

---

## Suppliers

### GET /suppliers

Get all active suppliers.

**Response:**
\\\json
{
  "success": true,
  "data": [
    {
      "supplier_id": "SUP-001",
      "name": "ABC Industries",
      "supplier_group_id": 1,
      "gstin": "27AABCT1234H1Z0",
      "payment_terms_days": 30,
      "lead_time_days": 7,
      "rating": 4.5,
      "is_active": true,
      "created_at": "2025-01-10T08:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
\\\

### GET /suppliers/:id

Get a specific supplier by ID.

**Parameters:**
- \id\ (string): Supplier ID (e.g., "SUP-001")

**Response:**
\\\json
{
  "success": true,
  "data": {
    "supplier_id": "SUP-001",
    "name": "ABC Industries",
    "gstin": "27AABCT1234H1Z0",
    "payment_terms_days": 30,
    "lead_time_days": 7,
    "rating": 4.5,
    "is_active": true
  }
}
\\\

### POST /suppliers

Create a new supplier.

**Request Body:**
\\\json
{
  "name": "New Supplier",
  "supplier_group_id": 1,
  "gstin": "27AABCS1234H1Z0",
  "payment_terms_days": 30,
  "lead_time_days": 7,
  "is_active": true
}
\\\

**Response:**
\\\json
{
  "success": true,
  "data": {
    "supplier_id": "SUP-1705318800000",
    "name": "New Supplier",
    "supplier_group_id": 1,
    "gstin": "27AABCS1234H1Z0",
    "payment_terms_days": 30,
    "lead_time_days": 7,
    "is_active": true
  }
}
\\\

### PUT /suppliers/:id

Update a supplier.

**Parameters:**
- \id\ (string): Supplier ID

**Request Body:**
\\\json
{
  "name": "Updated Name",
  "payment_terms_days": 45,
  "rating": 4.8
}
\\\

**Response:**
\\\json
{
  "success": true,
  "data": {
    "supplier_id": "SUP-001",
    "name": "Updated Name",
    "payment_terms_days": 45,
    "rating": 4.8
  }
}
\\\

### DELETE /suppliers/:id

Delete a supplier.

**Parameters:**
- \id\ (string): Supplier ID

**Response:**
\\\json
{
  "success": true,
  "message": "Supplier deleted successfully"
}
\\\

---

## Error Responses

All endpoints follow consistent error response format:

### 400 Bad Request
\\\json
{
  "success": false,
  "error": "Invalid request data"
}
\\\

### 404 Not Found
\\\json
{
  "success": false,
  "error": "Resource not found"
}
\\\

### 500 Internal Server Error
\\\json
{
  "success": false,
  "error": "Internal server error"
}
\\\

---

## Response Codes

- \200\ - OK (successful GET, PUT)
- \201\ - Created (successful POST)
- \204\ - No Content (successful DELETE)
- \400\ - Bad Request (invalid data)
- \404\ - Not Found (resource doesn't exist)
- \500\ - Internal Server Error

---

## Rate Limiting

Currently not implemented. Can be added using middleware.

## Authentication

Authentication is not implemented in this version. Prepare the structure:

`javascript
// Placeholder for future auth middleware
export function authenticateToken(req, res, next) {
  // Check Authorization header
  // Verify JWT token
  // Next or deny
}
`

---

## Testing with cURL

### Health Check
\\\ash
curl http://localhost:5000/api/health
\\\

### Get All Suppliers
\\\ash
curl http://localhost:5000/api/suppliers
\\\

### Create Supplier
\\\ash
curl -X POST http://localhost:5000/api/suppliers \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Test Supplier",
    "gstin": "27AABCT1234H1Z0",
    "payment_terms_days": 30
  }'
\\\

### Update Supplier
\\\ash
curl -X PUT http://localhost:5000/api/suppliers/SUP-001 \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Updated Name"
  }'
\\\

### Delete Supplier
\\\ash
curl -X DELETE http://localhost:5000/api/suppliers/SUP-001
\\\

---

## Future API Endpoints

The following endpoints are ready to be implemented:

### Purchase Orders
- \GET /purchase-orders\
- \POST /purchase-orders\
- \GET /purchase-orders/:id\
- \PUT /purchase-orders/:id\
- \DELETE /purchase-orders/:id\

### Invoices
- \GET /invoices\
- \POST /invoices\
- \GET /invoices/:id\

### Stock/Inventory
- \GET /stock\
- \GET /stock/:itemCode\
- \PUT /stock/:itemCode\

### Items
- \GET /items\
- \POST /items\
- \GET /items/:code\

---

## Implementation Guide

To add a new API endpoint:

1. **Create a Model** (\src/models/EntityModel.js\):
   \\\javascript
   export class EntityModel {
     static async getAll(db) { }
     static async getById(db, id) { }
     static async create(db, data) { }
     static async update(db, id, data) { }
     static async delete(db, id) { }
   }
   \\\

2. **Create a Controller** (\src/controllers/EntityController.js\):
   \\\javascript
   export class EntityController {
     static async getAll(req, res) { }
     static async getById(req, res) { }
     static async create(req, res) { }
     static async update(req, res) { }
     static async delete(req, res) { }
   }
   \\\

3. **Create Routes** (\src/routes/entities.js\):
   \\\javascript
   router.get('/', EntityController.getAll)
   router.post('/', EntityController.create)
   // ... more routes
   \\\

4. **Register Routes** (in \src/app.js\):
   \\\javascript
   app.use('/api/entities', entityRoutes)
   \\\

---

## Version

- **API Version**: 1.0.0
- **Last Updated**: 2025-01-15
