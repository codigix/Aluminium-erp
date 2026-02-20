# GRN Item-wise Logic Implementation
## Complete Shortage, Overage, Rejection & Inventory Handling

---

## 📋 Overview

This document describes the comprehensive GRN (Goods Receipt Note) item-wise processing system with:
- **Shortage Detection**: Received Qty < PO Qty
- **Overage Handling**: Received Qty > PO Qty (with approval workflow)
- **Rejection Logic**: Damaged/Failed QC items
- **Inventory Posting**: Only accepted quantities
- **PO Balance Tracking**: Real-time balance calculations
- **Dashboard Metrics**: Automatic updates

---

## 🏗️ Database Schema

### Tables Created

1. **grn_items** - Item-level GRN details
```sql
- id: Primary key
- grn_id: Foreign key to grns
- po_item_id: Foreign key to purchase_order_items
- po_qty: Ordered quantity
- received_qty: Physically received
- accepted_qty: Accepted after inspection
- rejected_qty: Rejected/damaged
- shortage_qty: PO Qty - Received Qty
- overage_qty: Received Qty - PO Qty
- status: RECEIVED, SHORT_RECEIPT, REJECTED, EXCESS_HOLD, EXCESS_ACCEPTED
- is_approved: For excess items
```

2. **grn_excess_approvals** - Overage approval workflow
```sql
- id: Primary key
- grn_item_id: Foreign key to grn_items
- excess_qty: Amount exceeding PO
- status: PENDING, Approved , REJECTED
- approval_notes: Manager notes for approval
- rejection_reason: Reason for rejection
```

3. **inventory** - Stock tracking
```sql
- id: Primary key
- item_code: Unique identifier
- stock_on_hand: Current available qty
- reorder_level: Minimum stock level
```

4. **inventory_postings** - Transaction ledger
```sql
- id: Primary key
- inventory_id: FK to inventory
- posting_type: INWARD, OUTWARD, REJECTION, RETURN
- quantity: Amount posted
- reference_type: GRN, SO, PO
- reference_id: ID of reference
```

5. **inventory_dashboard** - KPI metrics
```sql
- total_stock_on_hand: Current stock
- today_inward_qty: Today's receipts
- grn_count: Total GRNs processed
- pending_po_qty: Awaiting receipt
```

---

## 🔄 Processing Flow

### Step 1: Create GRN with Item Details

**Request:**
```bash
POST /api/grn-items/create-with-items
Content-Type: application/json
Authorization: Bearer {token}

{
  "poId": 5,
  "grnDate": "2026-01-07",
  "notes": "Partial delivery - 2 items short",
  "items": [
    {
      "poItemId": 10,
      "poQty": 100,
      "receivedQty": 95,
      "acceptedQty": 95,
      "rejectedQty": 0,
      "remarks": "2 pcs short as per packing list"
    },
    {
      "poItemId": 11,
      "poQty": 50,
      "receivedQty": 50,
      "acceptedQty": 48,
      "rejectedQty": 2,
      "remarks": "2 units found damaged"
    },
    {
      "poItemId": 12,
      "poQty": 25,
      "receivedQty": 30,
      "acceptedQty": 25,
      "rejectedQty": 0,
      "remarks": "5 units extra - overage"
    }
  ]
}
```

**Response:**
```json
{
  "grn_id": 15,
  "po_number": "PO-2026-0005",
  "grn_date": "2026-01-07",
  "items": [
    {
      "id": 42,
      "grn_id": 15,
      "po_item_id": 10,
      "po_qty": 100,
      "received_qty": 95,
      "accepted_qty": 95,
      "rejected_qty": 0,
      "shortage_qty": 5,
      "overage_qty": 0,
      "status": "SHORT_RECEIPT",
      "is_approved": false
    },
    {
      "id": 43,
      "grn_id": 15,
      "po_item_id": 11,
      "po_qty": 50,
      "received_qty": 50,
      "accepted_qty": 48,
      "rejected_qty": 2,
      "shortage_qty": 0,
      "overage_qty": 0,
      "status": "REJECTED",
      "is_approved": false
    },
    {
      "id": 44,
      "grn_id": 15,
      "po_item_id": 12,
      "po_qty": 25,
      "received_qty": 30,
      "accepted_qty": 25,
      "rejected_qty": 0,
      "shortage_qty": 0,
      "overage_qty": 5,
      "status": "EXCESS_HOLD",
      "is_approved": false
    }
  ],
  "summary": {
    "total_items": 3,
    "total_po_qty": 175,
    "total_received_qty": 175,
    "total_accepted_qty": 168,
    "total_rejected_qty": 2,
    "total_shortage_qty": 5,
    "total_overage_qty": 5,
    "by_status": {
      "SHORT_RECEIPT": { "count": 1, "accepted_qty": 95 },
      "REJECTED": { "count": 1, "accepted_qty": 48 },
      "EXCESS_HOLD": { "count": 1, "accepted_qty": 25 }
    }
  }
}
```

---

## 📊 Item Status Determination Matrix

| Scenario | Condition | Status | Action |
|----------|-----------|--------|--------|
| Full Receipt | Received = PO & Rejected = 0 | `RECEIVED` | Post to inventory |
| Short Qty | Received < PO | `SHORT_RECEIPT` | Keep PO open, post received |
| Damaged | Rejected > 0 | `REJECTED` | Post accepted, flag rejected |
| Excess Hold | Received > PO, Not Approved | `EXCESS_HOLD` | Hold until approval |
| Excess Approved | Received > PO, Approved | `EXCESS_ACCEPTED` | Post all to inventory |

---

## 🔐 Overage Approval Workflow

### Scenario: 5 units extra received

**Step 1: Check Excess Status**
```bash
GET /api/grn-items/44/details
```

Returns status: `EXCESS_HOLD` with overage_qty: 5

**Step 2: Manager Approves**
```bash
POST /api/grn-items/44/approve-excess
Content-Type: application/json
Authorization: Bearer {manager_token}

{
  "approvalNotes": "Extra stock accepted per vendor agreement. Will use in next batch."
}
```

**Step 3: System Updates**
- Status changes to: `EXCESS_ACCEPTED`
- `is_approved` = true
- Full received qty posted to inventory
- PO item balance recalculated

**Alternative: Manager Rejects Excess**
```bash
POST /api/grn-items/44/reject-excess
{
  "rejectionReason": "We did not order extra. Return to vendor immediately."
}
```

- Accepted Qty reverted to PO Qty (25)
- Excess qty flagged for return
- PO item marked `RECEIVED`

---

## 📦 Inventory Posting Rules

### Rule 1: Validation
```
Received Qty = Accepted Qty + Rejected Qty
```
If not equal → **ERROR**

### Rule 2: Stock In (INWARD)
Only **Accepted Qty** posted:
```
Stock On Hand += Accepted Qty
```

### Rule 3: Rejection Tracking
**Rejected Qty** noted (not in stock):
```
Posting Type: REJECTION
Quantity: Rejected Qty
Status: AWAITING RETURN/REPLACEMENT
```

### Rule 4: Shortage Handling
**Shortage Qty** remains against PO:
```
Balance Qty = PO Qty - Total Accepted Qty
Status: OPEN
```

---

## 🎯 PO Balance Calculation

### API: Get PO Balance
```bash
GET /api/grn-items/po/5/balance
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
    "open_items": 1,
    "closed_items": 2,
    "overall_status": "PARTIALLY_RECEIVED",
    "item_balances": [
      {
        "po_item_id": 10,
        "item_code": "ITEM001",
        "po_qty": 100,
        "accepted_qty": 95,
        "rejected_qty": 0,
        "balance_qty": 5,
        "status": "OPEN"
      },
      {
        "po_item_id": 11,
        "item_code": "ITEM002",
        "po_qty": 50,
        "accepted_qty": 48,
        "rejected_qty": 2,
        "balance_qty": 2,
        "status": "CLOSED"  // 48 + 0 = 50 (full qty accounted)
      },
      {
        "po_item_id": 12,
        "item_code": "ITEM003",
        "po_qty": 25,
        "accepted_qty": 25,
        "rejected_qty": 0,
        "balance_qty": 0,
        "status": "CLOSED"
      }
    ]
  }
}
```

---

## 🚀 API Endpoints

### GRN Item Management
```
POST   /api/grn-items/create-with-items          Create GRN with items
GET    /api/grn-items/:grnId/details             Get GRN item details
PATCH  /api/grn-items/:grnItemId                 Update GRN item
POST   /api/grn-items/:grnItemId/approve-excess  Approve overage
POST   /api/grn-items/:grnItemId/reject-excess   Reject overage
```

### Balance & Tracking
```
GET    /api/grn-items/po/:poId/balance           Get PO balance
GET    /api/grn-items/po-item/:poItemId/balance  Get item balance
GET    /api/grn-items/po/:poId/receipt-history   Get all GRNs for PO
GET    /api/grn-items/:grnId/summary             Get GRN summary
GET    /api/grn-items/:grnId/inventory-ledger    Get inventory postings
```

### Validation
```
POST   /api/grn-items/validate                   Validate GRN input
```

---

## 💾 Database Migration

Run the migration file:
```bash
mysql -u root -p database_name < migrations/003-grn-item-logic.sql
```

This creates:
- grn_items table
- grn_excess_approvals table
- inventory table
- inventory_postings table
- inventory_dashboard table
- Updated columns on purchase_order_items

---

## 🎬 Complete Example Flow

### Scenario: PO with multiple items, various receipt conditions

```
PO-2026-0005 created for:
- Item A: 100 units @ 50/unit
- Item B: 50 units @ 100/unit
- Item C: 25 units @ 200/unit
Total: ₹7,500

Day 1: First GRN
- Item A: Ordered 100, Received 95, Accepted 95, Rejected 0 → SHORT_RECEIPT
- Item B: Ordered 50, Received 50, Accepted 48, Rejected 2 → REJECTED
- Item C: Ordered 25, Received 30, Accepted 25, Rejected 0 → EXCESS_HOLD

Inventory Posted:
- Item A: +95 units
- Item B: +48 units (2 marked as rejection)
- Item C: Not posted (awaiting approval)

Stock On Hand: 143 units
Dashboard: PO: 2 open items, 1 pending approval

Day 2: Second GRN (Remainder)
- Item A: Ordered 100, Already received 95, Now 5 more received → SHORT_RECEIPT closed
- Item B: Replacement 2 units received, accepted 2 → REJECTED status cleared

PO Status: PARTIALLY_RECEIVED → RECEIVED (pending Item C approval)

Day 3: Item C Approval
- Manager approves excess 5 units
- Inventory: +30 units (was holding 25, now adds 5 more)

PO Status: COMPLETED ✓
```

---

## ⚠️ Important Rules

1. **Only ACCEPTED quantities reach inventory**
2. **Rejected quantities never affect stock**
3. **Shortage quantities keep PO open**
4. **Excess quantities require approval**
5. **PO closes only when: Total Accepted Qty = Total Ordered Qty**

---

## 🔍 Troubleshooting

### Error: "Received Qty must equal Accepted Qty + Rejected Qty"
**Solution:** Ensure the math is correct
```
Received = Accepted + Rejected
95 = 95 + 0 ✓
50 = 48 + 2 ✓
```

### Error: "GRN Item not found"
**Solution:** Check if grn_item_id exists before updating/approving

### Inventory not updating
**Solution:** Verify `accepted_qty > 0` before posting. Rejected items have separate tracking.

---

## 📈 Dashboard Metrics Updated

After each GRN:
- ✓ Stock On Hand
- ✓ Today Inward Qty
- ✓ GRN Count
- ✓ Pending PO Qty

---

## 🎓 Key Learnings

This system implements **real-world ERP GRN logic**:
- Handles partial deliveries
- Manages quality rejections
- Controls excess receipts
- Tracks balances in real-time
- Maintains complete audit trail
- Updates inventory only for accepted stock
- Provides manager approval workflows

Perfect for manufacturing, retail, or distribution businesses! ✅
