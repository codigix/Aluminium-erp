# PO → Receipt → GRN → Inventory - Process Summary

## 🎯 Quick Visual

```
DAY 0: Create PO
┌──────────────────┐
│  Purchase Order  │
│   PO-2026-0001   │
│                  │
│  Items:          │
│  • Item A: 100   │
│  • Item B: 50    │
│  • Item C: 25    │
│  Total: 175      │
└────────┬─────────┘
         │
         │ Auto-creates
         ▼
┌──────────────────┐
│   PO Receipt     │
│   DRAFT Status   │
│   receipt_id=15  │
└──────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│ DAY 1: GOODS ARRIVE - Create GRN with Item Details                │
│                                                                    │
│ ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐│
│ │ Item A              │  │ Item B              │  │ Item C       ││
│ │                     │  │                     │  │              ││
│ │ PO Qty: 100         │  │ PO Qty: 50          │  │ PO Qty: 25   ││
│ │ Received: 95        │  │ Received: 50        │  │ Received: 30 ││
│ │ Accepted: 95        │  │ Accepted: 48        │  │ Accepted: 25 ││
│ │ Rejected: 0         │  │ Rejected: 2         │  │ Rejected: 0  ││
│ │                     │  │                     │  │              ││
│ │ ❌ SHORT RECEIPT    │  │ ❌ REJECTED         │  │ ⚠️  EXCESS   ││
│ │ Shortage: 5         │  │ Damaged: 2          │  │ Overage: 5   ││
│ │                     │  │                     │  │ (HOLD)       ││
│ │ ✅ INVENTORY: +95   │  │ ✅ INVENTORY: +48   │  │ ❓ PENDING    ││
│ └─────────────────────┘  └─────────────────────┘  └──────────────┘│
│                                                                    │
│ System Auto-Calculates:                                           │
│ • Balance Qty = PO Qty - Accepted Qty                             │
│ • Item Status = OPEN / CLOSED / EXCESS                            │
│ • PO Status = PARTIALLY_RECEIVED                                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│ INVENTORY POSTING (Only Accepted Qty)                             │
│                                                                    │
│ Item A Stock:    0  +95  =  95 ✓                                  │
│ Item B Stock:    0  +48  =  48 ✓                                  │
│                       +2(rejected, NOT in stock)                  │
│ Item C Stock:    0   (HOLD)  0  ⏳ Awaiting Approval               │
│                                                                    │
│ Total Stock:    0  +143  = 143 (pending Item C approval)          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│ MANAGER DECISION: Approve or Reject Item C Excess?                │
│                                                                    │
│ ✅ APPROVE (Extra 5 units OK)                                     │
│    │                                                              │
│    └─► Status: EXCESS_ACCEPTED                                   │
│        Item C Stock: 0 + 30 = 30 ✓                               │
│        Total Stock: 143 + 30 = 173                               │
│                                                                    │
│ ❌ REJECT (Return extra 5 units)                                  │
│    │                                                              │
│    └─► Status: RECEIVED                                          │
│        Accepted Qty: 25 (PO qty only)                            │
│        Item C Stock: 0 + 25 = 25 ✓                               │
│        Return 5 units to vendor                                  │
│        Total Stock: 143 + 25 = 168                               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│ DAY 2-3: REMAINDER DELIVERY (2nd GRN)                             │
│                                                                    │
│ ┌──────────────────────┐  ┌─────────────────────┐                │
│ │ Item A Remainder     │  │ Item B Replacement  │                │
│ │ (5 short units)      │  │ (2 damaged units)   │                │
│ │                      │  │                     │                │
│ │ PO Qty: 100          │  │ PO Qty: 50          │                │
│ │ Received: 5          │  │ Received: 2         │                │
│ │ Accepted: 5          │  │ Accepted: 2         │                │
│ │                      │  │                     │                │
│ │ ✅ RECEIVED          │  │ ✅ RECEIVED         │                │
│ │ ✅ INVENTORY: +5     │  │ ✅ INVENTORY: +2    │                │
│ │                      │  │                     │                │
│ │ Total Item A:        │  │ Total Item B:       │                │
│ │ 95 + 5 = 100 ✓✓      │  │ 48 + 2 = 50 ✓✓      │                │
│ └──────────────────────┘  └─────────────────────┘                │
│                                                                    │
│ Final Stock:                                                      │
│ Item A: 100 units ✓ COMPLETE                                     │
│ Item B: 50 units ✓ COMPLETE                                      │
│ Item C: 25-30 units ✓ COMPLETE                                   │
│                                                                    │
│ PO Status: COMPLETED ✅                                           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data at Each Stage

### After First GRN
```
Purchase Order Status:      PARTIALLY_RECEIVED
  ├─ Item A: Balance 5 (OPEN)
  ├─ Item B: Balance 2 (OPEN - needs replacement)
  └─ Item C: Balance ? (EXCESS_HOLD - needs approval)

Stock On Hand:              143 units
  ├─ Item A: 95
  ├─ Item B: 48
  └─ Item C: 0 (on hold)

GRN Summary:
  ├─ Total Received: 175
  ├─ Total Accepted: 168
  ├─ Total Rejected: 2
  ├─ Total Shortage: 5
  └─ Total Overage: 5
```

### After Manager Approval
```
Stock On Hand:              173 units (if excess approved)
  ├─ Item A: 95
  ├─ Item B: 48
  └─ Item C: 30 ✓ (now in stock)

PO Status:                  PARTIALLY_RECEIVED
  └─ Still waiting for Item A remainder (5 units) and Item B replacement (2 units)
```

### After Second GRN (Remainder)
```
Purchase Order Status:      COMPLETED ✅
  ├─ Item A: Balance 0 (CLOSED) ✓
  ├─ Item B: Balance 0 (CLOSED) ✓
  └─ Item C: Balance 0 (CLOSED) ✓

Final Stock On Hand:        175 units
  ├─ Item A: 100 ✓
  ├─ Item B: 50 ✓
  └─ Item C: 25-30 ✓
```

---

## 🔑 Key Rules (Remember!)

| Rule | Details |
|------|---------|
| **Rule 1: Validation** | Received Qty = Accepted Qty + Rejected Qty |
| **Rule 2: Inventory Post** | Only Accepted Qty enters inventory |
| **Rule 3: Rejection Track** | Rejected Qty tracked separately (NOT in stock) |
| **Rule 4: Shortage** | Creates balance in PO (stays OPEN) |
| **Rule 5: Overage** | Requires manager approval before posting |
| **Rule 6: PO Complete** | When all items: Total Accepted = Total Ordered |
| **Rule 7: Multi-GRN** | Same PO can have multiple GRNs |
| **Rule 8: Balance** | Balance = PO Qty - Total Accepted Qty |

---

## 🚀 API Sequence

```
1. POST /api/purchase-orders
   └─ PO created + Receipt auto-created

2. POST /api/grn-items/create-with-items
   └─ GRN processed with item-wise logic

3. GET /api/grn-items/po/:poId/balance
   └─ Check remaining balance

4. POST /api/grn-items/:grnItemId/approve-excess  (if needed)
   └─ Manager approval for excess

5. GET /api/grn-items/:grnId/inventory-ledger
   └─ View all postings

6. POST /api/grn-items/create-with-items (2nd GRN)
   └─ Remainder/replacement delivery

7. GET /api/grn-items/po/:poId/balance
   └─ Verify PO complete (balance = 0)
```

---

## 📅 Typical Timeline

```
Day 0  08:00 AM  ✓ PO Created
             08:01 AM  ✓ Receipt Auto-Created (DRAFT)
             08:05 AM  ✓ GRN and QC Records Created

Day 1  02:00 PM  ✓ Goods Received
             02:15 PM  ✓ GRN Created with Item Details
             02:30 PM  ✓ Inventory Posted (168 units)
             03:00 PM  ⏳ Manager Reviews Excess (Item C)
             03:30 PM  ✓ Excess Approved (+30 units)
             03:45 PM  ⚠️  Balance Check: Waiting for 5+2 units

Day 2  09:00 AM  ✓ Remainder Delivery Received
             09:15 AM  ✓ 2nd GRN Created
             09:30 AM  ✓ Inventory Updated (+5 +2 units)
             09:45 AM  ✓ PO Balance: All Zero
             10:00 AM  ✓ PO Status: COMPLETED

TOTAL TIME: ~26 hours
FINAL STOCK: 175 units (or 168 if excess rejected)
```

---

## 💡 Real-World Scenarios

### Scenario 1: Perfect Delivery
```
Received = PO Qty
Accepted = Received
Rejected = 0
Overage = 0
Result: Single GRN, all items CLOSED immediately
```

### Scenario 2: Partial + Damaged
```
Item A: 95/100 (short 5)
Item B: 48/50 + 2 rejected (damaged)
Result: Item A OPEN, Item B needs replacement
Action: Wait for 2nd GRN with remainder + replacement
```

### Scenario 3: Excess Stock
```
Received > PO Qty
Status: EXCESS_HOLD
Result: Manager must approve before posting to inventory
Action: Approve (+stock) or Reject (return to vendor)
```

---

## ✅ Success Checklist

Before marking PO as COMPLETED, verify:

- [ ] All items have GRN records
- [ ] All received quantities properly logged
- [ ] All accepted quantities posted to inventory
- [ ] All rejected quantities tracked separately
- [ ] All shortages documented
- [ ] All excess approved/rejected by manager
- [ ] Inventory stock matches accepted quantities
- [ ] PO balance equals zero for all items
- [ ] All inventory postings recorded in ledger
- [ ] Dashboard metrics updated

---

## 🎓 Learning Path

1. **Understand PO Creation** → Automatic Receipt creation
2. **Learn GRN Processing** → Item-wise decision making
3. **Master Inventory Posting** → Only accepted quantities
4. **Track PO Balance** → Real-time remaining quantities
5. **Handle Exceptions** → Shortage, Rejection, Overage
6. **Approve Excess** → Manager workflow
7. **Multi-GRN Process** → Multiple deliveries, single PO
8. **Complete PO** → When all items received

This is real-world ERP logic! 🚀
