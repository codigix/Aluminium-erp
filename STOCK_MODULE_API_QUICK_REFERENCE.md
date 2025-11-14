# 📦 Stock Module - API Quick Reference Guide

**Status:** ✅ All 63 endpoints ready  
**Base URL:** `http://localhost:5000/api/stock`

---

## 🚀 QUICK START - TEST THE APIs

### 1. Test Warehouse APIs

```bash
# Get all warehouses
curl -X GET http://localhost:5000/api/stock/warehouses

# Get warehouse hierarchy
curl -X GET http://localhost:5000/api/stock/warehouses/hierarchy

# Create warehouse
curl -X POST http://localhost:5000/api/stock/warehouses \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_code": "WH-TEST",
    "warehouse_name": "Test Warehouse",
    "warehouse_type": "Raw Material",
    "location": "Block A",
    "capacity": 10000
  }'
```

### 2. Test Stock Balance APIs

```bash
# Get all stock balances
curl -X GET http://localhost:5000/api/stock/stock-balance

# Get low stock items
curl -X GET http://localhost:5000/api/stock/stock-balance/low-stock

# Get dashboard summary
curl -X GET http://localhost:5000/api/stock/stock-balance/dashboard/summary

# Get stock value summary
curl -X GET http://localhost:5000/api/stock/stock-balance/summary
```

### 3. Test Stock Ledger APIs

```bash
# Get all stock ledger entries
curl -X GET http://localhost:5000/api/stock/ledger

# Get consumption report
curl -X GET "http://localhost:5000/api/stock/ledger/reports/consumption?startDate=2024-01-01&endDate=2024-12-31"

# Get valuation report
curl -X GET http://localhost:5000/api/stock/ledger/reports/valuation

# Get monthly consumption chart
curl -X GET "http://localhost:5000/api/stock/ledger/reports/monthly-chart?months=6"
```

### 4. Test Stock Entry APIs

```bash
# Get all stock entries
curl -X GET http://localhost:5000/api/stock/entries

# Get next entry number
curl -X GET "http://localhost:5000/api/stock/entries/next-number?entryType=Material%20Receipt"

# Create stock entry
curl -X POST http://localhost:5000/api/stock/entries \
  -H "Content-Type: application/json" \
  -d '{
    "entry_no": "SE-202401-000001",
    "entry_date": "2024-01-15",
    "entry_type": "Material Receipt",
    "from_warehouse_id": 1,
    "to_warehouse_id": 1,
    "purpose": "Purchase receipt",
    "items": [
      {
        "item_id": 1,
        "qty": 100,
        "uom": "Kg",
        "valuation_rate": 50
      }
    ]
  }'

# Get entry statistics
curl -X GET "http://localhost:5000/api/stock/entries/statistics"

# Submit entry
curl -X POST http://localhost:5000/api/stock/entries/1/submit
```

### 5. Test Material Transfer APIs

```bash
# Get all transfers
curl -X GET http://localhost:5000/api/stock/transfers

# Get next transfer number
curl -X GET http://localhost:5000/api/stock/transfers/next-number

# Create transfer
curl -X POST http://localhost:5000/api/stock/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "transfer_no": "MT-202401-000001",
    "transfer_date": "2024-01-15",
    "from_warehouse_id": 1,
    "to_warehouse_id": 2,
    "transfer_remarks": "Stock replenishment",
    "items": [
      {
        "item_id": 1,
        "qty": 50,
        "uom": "Kg"
      }
    ]
  }'

# Send transfer
curl -X POST http://localhost:5000/api/stock/transfers/1/send

# Receive transfer
curl -X POST http://localhost:5000/api/stock/transfers/1/receive

# Get transfer register
curl -X GET "http://localhost:5000/api/stock/transfers/reports/register?startDate=2024-01-01&endDate=2024-12-31"
```

### 6. Test Batch Tracking APIs

```bash
# Get all batches
curl -X GET http://localhost:5000/api/stock/batches

# Create batch
curl -X POST http://localhost:5000/api/stock/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-001",
    "item_id": 1,
    "batch_qty": 1000,
    "mfg_date": "2024-01-01",
    "expiry_date": "2024-12-31",
    "warehouse_id": 1,
    "remarks": "First batch"
  }'

# Get expired batches
curl -X GET http://localhost:5000/api/stock/batches/alerts/expired

# Get near-expiry batches (within 30 days)
curl -X GET "http://localhost:5000/api/stock/batches/alerts/near-expiry?daysThreshold=30"

# Get batch traceability
curl -X GET http://localhost:5000/api/stock/batches/BATCH-001/traceability
```

### 7. Test Stock Reconciliation APIs

```bash
# Get all reconciliations
curl -X GET http://localhost:5000/api/stock/reconciliation

# Get next reconciliation number
curl -X GET http://localhost:5000/api/stock/reconciliation/next-number

# Create reconciliation
curl -X POST http://localhost:5000/api/stock/reconciliation \
  -H "Content-Type: application/json" \
  -d '{
    "reconciliation_no": "SR-202401-000001",
    "reconciliation_date": "2024-01-15",
    "warehouse_id": 1,
    "purpose": "Physical count audit"
  }'

# Add reconciliation items
curl -X POST http://localhost:5000/api/stock/reconciliation/1/items \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "item_id": 1,
        "system_qty": 100,
        "physical_qty": 95,
        "variance_reason": "Breakage during handling"
      }
    ]
  }'

# Submit reconciliation
curl -X POST http://localhost:5000/api/stock/reconciliation/1/submit

# Approve reconciliation
curl -X POST http://localhost:5000/api/stock/reconciliation/1/approve
```

### 8. Test Reorder Management APIs

```bash
# Get all reorder requests
curl -X GET http://localhost:5000/api/stock/reorder

# Generate reorder request (auto-detect low stock)
curl -X POST http://localhost:5000/api/stock/reorder/generate

# Get reorder dashboard
curl -X GET http://localhost:5000/api/stock/reorder/dashboard

# Get low stock summary
curl -X GET http://localhost:5000/api/stock/reorder/reports/low-stock

# Get reorder statistics
curl -X GET http://localhost:5000/api/stock/reorder/reports/statistics

# Create material request from reorder
curl -X POST http://localhost:5000/api/stock/reorder/1/create-mr

# Mark as received
curl -X POST http://localhost:5000/api/stock/reorder/1/mark-received \
  -H "Content-Type: application/json" \
  -d '{
    "poNo": "PO-2024-001"
  }'
```

---

## 📊 EXAMPLE RESPONSES

### Get Warehouses
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "warehouse_code": "WH-001",
      "warehouse_name": "Raw Material Store",
      "warehouse_type": "Raw Material",
      "location": "Block A - Ground Floor",
      "department": "buying",
      "is_active": true,
      "capacity": 50000
    }
  ],
  "count": 1
}
```

### Get Stock Balance
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "item_code": "ALU-001",
      "item_name": "Aluminum Ingot",
      "warehouse_code": "WH-001",
      "warehouse_name": "Raw Material Store",
      "current_qty": 5000,
      "reserved_qty": 500,
      "available_qty": 4500,
      "valuation_rate": 100.50,
      "total_value": 502500,
      "reorder_level": 1000
    }
  ],
  "count": 1
}
```

### Get Low Stock Items
```json
{
  "success": true,
  "data": [
    {
      "item_code": "ALU-002",
      "item_name": "Aluminum Rod",
      "warehouse_name": "Raw Material Store",
      "available_qty": 450,
      "reorder_level": 1000,
      "reorder_qty": 2000,
      "qty_to_order": 550
    }
  ],
  "count": 1
}
```

### Get Dashboard Summary
```json
{
  "success": true,
  "data": {
    "totalItems": 15,
    "totalValue": 2500000,
    "totalQty": 25000,
    "warehouseCount": 4,
    "lowStockCount": 3,
    "lowStockItems": [...],
    "warehouseStats": [...]
  }
}
```

---

## 🔍 FILTERING & QUERY PARAMETERS

### Stock Balance Filters
```bash
# Filter by warehouse
?warehouseId=1

# Filter by item
?itemId=5

# Filter by stock status (below_reorder, near_reorder)
?stockStatus=below_reorder

# Search by code or name
?search=Aluminum

# Filter by locked status
?isLocked=true
```

### Stock Ledger Filters
```bash
# Filter by item and warehouse
?itemId=1&warehouseId=2

# Filter by transaction type
?transactionType=Material%20Receipt

# Filter by date range
?startDate=2024-01-01&endDate=2024-12-31

# Search by item
?search=Aluminum
```

### Stock Entry Filters
```bash
# Filter by status (Draft, Submitted, Cancelled)
?status=Submitted

# Filter by entry type
?entryType=Material%20Receipt

# Filter by warehouse
?warehouseId=1

# Filter by date range
?startDate=2024-01-01&endDate=2024-12-31
```

---

## 🛡️ ERROR HANDLING

### Common Error Responses

**400 - Bad Request**
```json
{
  "success": false,
  "error": "Missing required fields"
}
```

**404 - Not Found**
```json
{
  "success": false,
  "error": "Warehouse not found"
}
```

**500 - Server Error**
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

---

## 📋 RESPONSE CODES

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | GET request successful |
| 201 | Created | POST request successful |
| 400 | Bad Request | Missing required fields |
| 403 | Forbidden | No access permission |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Database or system error |

---

## 🔐 AUTHENTICATION

All endpoints require JWT token in header:

```bash
curl -X GET http://localhost:5000/api/stock/warehouses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📍 ENDPOINT SUMMARY

| Module | Count | Endpoints |
|--------|-------|-----------|
| Warehouses | 7 | CRUD + Hierarchy |
| Stock Balance | 8 | Balance + Queries |
| Stock Ledger | 7 | Reports + Analytics |
| Stock Entries | 8 | Document workflow |
| Material Transfers | 7 | Transfer management |
| Batch Tracking | 10 | Batch + Alerts |
| Stock Reconciliation | 9 | Audit + Adjustment |
| Reorder Management | 7 | Auto-reorder + Alerts |
| **TOTAL** | **63** | **Complete coverage** |

---

## 🎯 TESTING WORKFLOW

1. **Create warehouse** → `/api/stock/warehouses`
2. **Create stock entry** → `/api/stock/entries`
3. **Submit entry** → `/api/stock/entries/:id/submit`
4. **Check balance** → `/api/stock/stock-balance`
5. **Create transfer** → `/api/stock/transfers`
6. **Receive transfer** → `/api/stock/transfers/:id/receive`
7. **Create reconciliation** → `/api/stock/reconciliation`
8. **Approve reconciliation** → `/api/stock/reconciliation/:id/approve`

---

**All APIs tested and ready for frontend integration! 🚀**