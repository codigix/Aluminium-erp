# PO Receipt & GRN Processing - Complete Workflow

## 🔄 End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PURCHASE ORDER CREATED                            │
│                                                                       │
│  POST /api/purchase-orders                                           │
│  {                                                                   │
│    "quotationId": 5,                                                 │
│    "expectedDeliveryDate": "2026-01-20",                             │
│    "notes": "Standard order"                                         │
│  }                                                                   │
│                                                                       │
│  Response: PO-2026-0001 with Items                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│          AUTO-CREATE PO RECEIPT (DRAFT STATUS)                       │
│                                                                       │
│  Automatic when PO is created:                                      │
│  - PO Receipt created with status: DRAFT                            │
│  - Receipt Date: Today                                              │
│  - Received Qty: 0                                                  │
│  - Notes: Auto-created for PO PO-2026-0001                          │
│                                                                       │
│  Database: po_receipts table                                        │
│  receipt_id: 15                                                     │
│  po_id: 5                                                           │
│  status: DRAFT                                                      │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              GOODS RECEIVED (CREATE GRN WITH ITEMS)                  │
│                                                                       │
│  POST /api/grn-items/create-with-items                              │
│  {                                                                   │
│    "poId": 5,                                                        │
│    "grnDate": "2026-01-15",                                          │
│    "items": [                                                        │
│      {                                                               │
│        "poItemId": 10,                                               │
│        "poQty": 100,                                                 │
│        "receivedQty": 95,          ← Less received                   │
│        "acceptedQty": 95,                                            │
│        "rejectedQty": 0,                                             │
│        "remarks": "2 units short"                                    │
│      },                                                              │
│      {                                                               │
│        "poItemId": 11,                                               │
│        "poQty": 50,                                                  │
│        "receivedQty": 50,          ← Exact match                     │
│        "acceptedQty": 48,          ← Some damaged                    │
│        "rejectedQty": 2,                                             │
│        "remarks": "2 damaged units"                                  │
│      },                                                              │
│      {                                                               │
│        "poItemId": 12,                                               │
│        "poQty": 25,                                                  │
│        "receivedQty": 30,          ← More received                   │
│        "acceptedQty": 25,                                            │
│        "rejectedQty": 0,                                             │
│        "remarks": "5 extra units"                                    │
│      }                                                               │
│    ]                                                                 │
│  }                                                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              GRN PROCESSING - ITEM-WISE DECISION                     │
│                                                                       │
│  Item 1: Shortage Case                                              │
│  ────────────────────                                               │
│  - Received: 95, PO Qty: 100                                        │
│  - Status: SHORT_RECEIPT                                            │
│  - Shortage Qty: 5                                                  │
│  - Inventory: +95 units POSTED ✓                                    │
│  - PO Item Balance: 5 remaining (OPEN)                              │
│                                                                       │
│  Item 2: Rejection Case                                             │
│  ──────────────────────                                             │
│  - Received: 50, Accepted: 48, Rejected: 2                          │
│  - Status: REJECTED                                                 │
│  - Inventory: +48 units POSTED ✓                                    │
│  - Rejected Qty: 2 tracked separately (AWAITING RETURN)             │
│  - PO Item Balance: 2 remaining (needs replacement)                 │
│                                                                       │
│  Item 3: Overage Case (EXCESS HOLD)                                 │
│  ──────────────────────────────────                                 │
│  - Received: 30, PO Qty: 25                                         │
│  - Status: EXCESS_HOLD (pending approval)                           │
│  - Overage Qty: 5                                                   │
│  - Inventory: NOT POSTED YET (on hold)                              │
│  - Requires Manager Approval                                        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│           INVENTORY POSTING (AUTO - ONLY ACCEPTED QTY)               │
│                                                                       │
│  Database: inventory + inventory_postings                           │
│                                                                       │
│  Item A (Code: ITEM001)                                             │
│  ├─ Stock On Hand: 0 → 95 ✓                                         │
│  └─ Posting: INWARD | Qty: 95 | Ref: GRN-15                         │
│                                                                       │
│  Item B (Code: ITEM002)                                             │
│  ├─ Stock On Hand: 0 → 48 ✓                                         │
│  ├─ Posting 1: INWARD | Qty: 48 | Ref: GRN-15                       │
│  └─ Posting 2: REJECTION | Qty: 2 | Status: AWAITING RETURN         │
│                                                                       │
│  Item C (Code: ITEM003)                                             │
│  ├─ Stock On Hand: UNCHANGED (0 → 0)                                │
│  └─ Status: EXCESS_HOLD - waiting for approval                      │
│                                                                       │
│  Dashboard Updated:                                                 │
│  ├─ Total Stock: 0 → 143 ✓                                          │
│  ├─ Today Inward: 143 units                                         │
│  └─ GRN Count: 1                                                    │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│             PO BALANCE CALCULATED & STATUS UPDATED                   │
│                                                                       │
│  GET /api/grn-items/po/5/balance                                    │
│                                                                       │
│  Overall PO Status: PARTIALLY_RECEIVED                              │
│  ├─ Total Items: 3                                                  │
│  ├─ Total Ordered: 175 units                                        │
│  ├─ Total Accepted: 168 units                                       │
│  ├─ Total Rejected: 2 units                                         │
│  ├─ Total Balance: 7 units (pending)                                │
│  ├─ Open Items: 2                                                   │
│  └─ Closed Items: 1                                                 │
│                                                                       │
│  Item Balances:                                                     │
│  ├─ Item A: Balance 5 | Status: OPEN                                │
│  ├─ Item B: Balance 2 | Status: OPEN (needs replacement)            │
│  └─ Item C: Balance ? | Status: EXCESS_HOLD (approval pending)      │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│            MANAGER APPROVAL - EXCESS QUANTITY                        │
│                                                                       │
│  Item C Status: EXCESS_HOLD (5 extra units)                         │
│                                                                       │
│  OPTION 1: APPROVE EXCESS                                           │
│  ────────────────────────                                           │
│  POST /api/grn-items/44/approve-excess                              │
│  {                                                                   │
│    "approvalNotes": "Extra units approved per vendor agreement"     │
│  }                                                                   │
│                                                                       │
│  Result:                                                            │
│  - Status Changes: EXCESS_HOLD → EXCESS_ACCEPTED ✓                  │
│  - Inventory POSTED: +30 units (was 25, now adds 5)                 │
│  - is_approved: true                                                │
│  - Item C Closed (Full 30 accepted)                                 │
│                                                                       │
│  OR                                                                  │
│                                                                       │
│  OPTION 2: REJECT EXCESS                                            │
│  ──────────────────────                                             │
│  POST /api/grn-items/44/reject-excess                               │
│  {                                                                   │
│    "rejectionReason": "Return excess 5 units to vendor"             │
│  }                                                                   │
│                                                                       │
│  Result:                                                            │
│  - Status Changes: EXCESS_HOLD → RECEIVED                           │
│  - Accepted Qty: 25 (PO Qty only)                                   │
│  - Inventory POSTED: +25 units (excess 5 not posted)                │
│  - 5 units flagged for return                                       │
│  - Item C Closed (25 accepted, 5 to return)                         │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SCENARIO A: EXCESS APPROVED                             │
│                                                                       │
│  After Approval:                                                    │
│                                                                       │
│  Stock Update:                                                      │
│  ├─ Item A: 95 units (SHORT_RECEIPT - balance 5 pending)            │
│  ├─ Item B: 48 units (REJECTED - 2 damaged, balance 2 pending)      │
│  └─ Item C: 30 units (EXCESS_ACCEPTED - fully received) ✓           │
│                                                                       │
│  Total Stock On Hand: 173 units                                     │
│                                                                       │
│  PO Status: PARTIALLY_RECEIVED                                      │
│  └─ Still waiting for:                                              │
│     - 5 more units of Item A (SHORT)                                │
│     - 2 replacement units of Item B (DAMAGED)                       │
│                                                                       │
│  Next Step: Vendor sends 2nd GRN with remaining items               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SCENARIO B: EXCESS REJECTED                             │
│                                                                       │
│  After Rejection:                                                   │
│                                                                       │
│  Stock Update:                                                      │
│  ├─ Item A: 95 units (SHORT_RECEIPT - balance 5 pending)            │
│  ├─ Item B: 48 units (REJECTED - 2 damaged, balance 2 pending)      │
│  └─ Item C: 25 units (RECEIVED - excess 5 to return) ✓              │
│                                                                       │
│  Total Stock On Hand: 168 units                                     │
│  Return Queue: 5 units of Item C                                    │
│                                                                       │
│  PO Status: PARTIALLY_RECEIVED                                      │
│  └─ Still waiting for:                                              │
│     - 5 more units of Item A (SHORT)                                │
│     - 2 replacement units of Item B (DAMAGED)                       │
│     - 5 units of Item C being returned                              │
│                                                                       │
│  Next Step: Vendor sends 2nd GRN with remaining items               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│          DAY 2: SECOND GRN (REMAINDER / REPLACEMENT ITEMS)           │
│                                                                       │
│  Vendor sends remainder delivery:                                   │
│                                                                       │
│  POST /api/grn-items/create-with-items                              │
│  {                                                                   │
│    "poId": 5,                                                        │
│    "grnDate": "2026-01-18",                                          │
│    "items": [                                                        │
│      {                                                               │
│        "poItemId": 10,                                               │
│        "poQty": 100,                                                 │
│        "receivedQty": 5,           ← The 5 that were short           │
│        "acceptedQty": 5,                                             │
│        "rejectedQty": 0,                                             │
│        "remarks": "Remainder delivery"                               │
│      },                                                              │
│      {                                                               │
│        "poItemId": 11,                                               │
│        "poQty": 50,                                                  │
│        "receivedQty": 2,           ← Replacement for damaged         │
│        "acceptedQty": 2,                                             │
│        "rejectedQty": 0,                                             │
│        "remarks": "Replacement for damaged units"                    │
│      }                                                               │
│    ]                                                                 │
│  }                                                                   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│         FINAL INVENTORY POSTING (2ND GRN)                            │
│                                                                       │
│  Item A: +5 units (completing Item A)                               │
│  └─ Total for Item A: 95 + 5 = 100 ✓ COMPLETE                       │
│                                                                       │
│  Item B: +2 units (replacement)                                     │
│  └─ Total for Item B: 48 + 2 = 50 ✓ COMPLETE                        │
│                                                                       │
│  Final Stock:                                                       │
│  ├─ Item A: 100 units                                               │
│  ├─ Item B: 50 units                                                │
│  └─ Item C: 25-30 units (depending on excess decision)               │
│                                                                       │
│  Total Stock On Hand: 175-180 units ✓                               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PO STATUS: COMPLETED ✅                            │
│                                                                       │
│  Final PO Balance:                                                  │
│  ├─ Item A: Balance 0 | Status: CLOSED ✓                            │
│  ├─ Item B: Balance 0 | Status: CLOSED ✓                            │
│  └─ Item C: Balance 0 | Status: CLOSED ✓                            │
│                                                                       │
│  All Items Received ✓                                               │
│  All Items Inspected ✓                                              │
│  All Inventory Posted ✓                                             │
│  All Approvals Complete ✓                                           │
│                                                                       │
│  PO-2026-0001: COMPLETED                                            │
│  Process Time: 3 days                                               │
│  Final Stock Added: 175 units                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step API Calls

### Step 1: Create Purchase Order
```bash
curl -X POST http://localhost:5000/api/purchase-orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quotationId": 5,
    "expectedDeliveryDate": "2026-01-20",
    "notes": "Standard PO"
  }'
```

**Response:**
```json
{
  "message": "Purchase Order created",
  "data": {
    "id": 5,
    "po_number": "PO-2026-0001",
    "receipt_id": 15
  }
}
```

**What Happens:**
- ✓ PO created with status: ORDERED
- ✓ PO Receipt auto-created with status: DRAFT
- ✓ GRN and QC records auto-created

---

### Step 2: Create GRN with Items (First Delivery)
```bash
curl -X POST http://localhost:5000/api/grn-items/create-with-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "poId": 5,
    "grnDate": "2026-01-15",
    "notes": "First delivery - partial",
    "items": [
      {
        "poItemId": 10,
        "poQty": 100,
        "receivedQty": 95,
        "acceptedQty": 95,
        "rejectedQty": 0,
        "remarks": "2 units short"
      },
      {
        "poItemId": 11,
        "poQty": 50,
        "receivedQty": 50,
        "acceptedQty": 48,
        "rejectedQty": 2,
        "remarks": "2 damaged"
      },
      {
        "poItemId": 12,
        "poQty": 25,
        "receivedQty": 30,
        "acceptedQty": 25,
        "rejectedQty": 0,
        "remarks": "5 extra units"
      }
    ]
  }'
```

**Response:**
```json
{
  "grn_id": 15,
  "po_number": "PO-2026-0001",
  "items": [
    {
      "id": 42,
      "status": "SHORT_RECEIPT",
      "shortage_qty": 5,
      "accepted_qty": 95
    },
    {
      "id": 43,
      "status": "REJECTED",
      "rejected_qty": 2,
      "accepted_qty": 48
    },
    {
      "id": 44,
      "status": "EXCESS_HOLD",
      "overage_qty": 5,
      "accepted_qty": 25
    }
  ],
  "summary": {
    "total_accepted_qty": 168,
    "total_rejected_qty": 2,
    "total_overage_qty": 5
  }
}
```

---

### Step 3: Check PO Balance
```bash
curl -X GET http://localhost:5000/api/grn-items/po/5/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "po_id": 5,
  "balance_info": {
    "total_items": 3,
    "total_po_qty": 175,
    "total_accepted_qty": 168,
    "total_rejected_qty": 2,
    "total_balance_qty": 7,
    "open_items": 2,
    "closed_items": 1,
    "overall_status": "PARTIALLY_RECEIVED",
    "item_balances": [
      {
        "po_item_id": 10,
        "item_code": "ITEM001",
        "po_qty": 100,
        "accepted_qty": 95,
        "balance_qty": 5,
        "status": "OPEN"
      }
    ]
  }
}
```

---

### Step 4: Manager Approves Excess (Item C)
```bash
curl -X POST http://localhost:5000/api/grn-items/44/approve-excess \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approvalNotes": "Approved for future use"
  }'
```

**Response:**
```json
{
  "message": "Excess quantity approved",
  "approval_result": {
    "id": 44,
    "status": "EXCESS_ACCEPTED",
    "is_approved": true
  }
}
```

---

### Step 5: View Inventory Ledger
```bash
curl -X GET http://localhost:5000/api/grn-items/15/inventory-ledger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "grn_id": 15,
  "inventory_ledgers": [
    {
      "item_code": "ITEM001",
      "item_description": "Component A",
      "current_stock": 95,
      "postings": [
        {
          "posting_type": "INWARD",
          "quantity": 95,
          "reference_type": "GRN",
          "remarks": "Accepted from GRN 15"
        }
      ]
    },
    {
      "item_code": "ITEM002",
      "item_description": "Component B",
      "current_stock": 48,
      "postings": [
        {
          "posting_type": "INWARD",
          "quantity": 48,
          "remarks": "Accepted from GRN 15"
        },
        {
          "posting_type": "REJECTION",
          "quantity": 2,
          "remarks": "Damaged from GRN 15 - Awaiting return"
        }
      ]
    },
    {
      "item_code": "ITEM003",
      "item_description": "Component C",
      "current_stock": 30,
      "postings": [
        {
          "posting_type": "INWARD",
          "quantity": 30,
          "remarks": "Approved excess from GRN 15"
        }
      ]
    }
  ]
}
```

---

### Step 6: Create Second GRN (Remainder)
```bash
curl -X POST http://localhost:5000/api/grn-items/create-with-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "poId": 5,
    "grnDate": "2026-01-18",
    "items": [
      {
        "poItemId": 10,
        "poQty": 100,
        "receivedQty": 5,
        "acceptedQty": 5,
        "rejectedQty": 0,
        "remarks": "Remainder delivery"
      },
      {
        "poItemId": 11,
        "poQty": 50,
        "receivedQty": 2,
        "acceptedQty": 2,
        "rejectedQty": 0,
        "remarks": "Replacement for damaged"
      }
    ]
  }'
```

---

### Step 7: Final PO Balance Check
```bash
curl -X GET http://localhost:5000/api/grn-items/po/5/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "overall_status": "COMPLETED",
  "total_items": 3,
  "total_po_qty": 175,
  "total_accepted_qty": 175,
  "closed_items": 3,
  "item_balances": [
    {
      "po_item_id": 10,
      "balance_qty": 0,
      "status": "CLOSED"
    },
    {
      "po_item_id": 11,
      "balance_qty": 0,
      "status": "CLOSED"
    },
    {
      "po_item_id": 12,
      "balance_qty": 0,
      "status": "CLOSED"
    }
  ]
}
```

---

## 📊 Database Data Flow

### Purchase Orders Table
```sql
SELECT * FROM purchase_orders WHERE id = 5;

id=5
po_number='PO-2026-0001'
status='ORDERED' → 'PARTIALLY_RECEIVED' → 'COMPLETED'
total_amount=7500
created_at='2026-01-07'
```

### PO Receipts Table (Auto-Created)
```sql
SELECT * FROM po_receipts WHERE po_id = 5;

id=15
po_id=5
receipt_date='2026-01-07'
received_quantity=0
status='DRAFT'
```

### GRN Items Table
```sql
SELECT * FROM grn_items WHERE grn_id = 15;

id=42: po_item_id=10, status='SHORT_RECEIPT', shortage_qty=5, accepted_qty=95
id=43: po_item_id=11, status='REJECTED', rejected_qty=2, accepted_qty=48
id=44: po_item_id=12, status='EXCESS_HOLD'→'EXCESS_ACCEPTED', overage_qty=5
```

### Inventory Table
```sql
SELECT * FROM inventory WHERE item_code IN ('ITEM001','ITEM002','ITEM003');

item_code='ITEM001': stock_on_hand=100 (95+5 from 2 GRNs)
item_code='ITEM002': stock_on_hand=50  (48+2 from 2 GRNs)
item_code='ITEM003': stock_on_hand=30  (from GRN 1, approved excess)
```

### Inventory Postings (Ledger)
```sql
SELECT * FROM inventory_postings WHERE reference_id = 15;

INWARD | ITEM001 | 95 | GRN | Accepted
INWARD | ITEM002 | 48 | GRN | Accepted
REJECTION | ITEM002 | 2 | GRN | Damaged, awaiting return
INWARD | ITEM003 | 30 | GRN | Approved excess

-- Second GRN
INWARD | ITEM001 | 5 | GRN | Remainder
INWARD | ITEM002 | 2 | GRN | Replacement
```

---

## ✅ Key Checkpoints

| Checkpoint | Status | Verify |
|-----------|--------|---------|
| PO Created | ✓ | `po_number = PO-2026-0001` |
| Receipt Auto-Created | ✓ | `po_receipts.status = DRAFT` |
| GRN Items Processed | ✓ | `grn_items.status` in (RECEIVED, SHORT_RECEIPT, REJECTED, EXCESS_HOLD) |
| Inventory Posted (Accepted Only) | ✓ | `inventory.stock_on_hand = sum(accepted_qty)` |
| PO Balance Calculated | ✓ | `balance_qty = po_qty - total_accepted_qty` |
| Excess Approved | ✓ | `grn_excess_approvals.status = APPROVED` |
| PO Complete | ✓ | `purchase_orders.status = COMPLETED` |

---

## 🎯 Summary

**Process Flow:**
1. PO Created → Receipt Auto-Created (DRAFT)
2. Goods Arrive → GRN Created with Item Details
3. Item-wise Decision → Shortage/Rejection/Overage Detected
4. Inventory Posted → Only Accepted Qty Added
5. Balance Calculated → PO Status Updated
6. Excess Approved/Rejected → Final Decision
7. Remainder GRN → PO Completed

**Total Time:** 1-3 days (typical scenario)  
**Final Stock:** Sum of all accepted quantities across all GRNs  
**PO Status:** COMPLETED when all items received (or accepted)
