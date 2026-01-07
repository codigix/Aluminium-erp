# GRN Item-wise Logic - Quick Reference

## 🎯 One-Line Summary
**PO → GRN Items (Shortage/Overage/Rejection) → Inventory Posting → Dashboard Update**

---

## 📌 Status Meanings

| Status | Meaning | Action |
|--------|---------|--------|
| `RECEIVED` | Full receipt, all accepted | Posted to inventory ✓ |
| `SHORT_RECEIPT` | Less received than ordered | Post received, PO stays open |
| `REJECTED` | Contains damaged/failed items | Post accepted, track rejected separately |
| `EXCESS_HOLD` | More received than ordered | Hold until manager approval |
| `EXCESS_ACCEPTED` | Excess approved by manager | Post all to inventory ✓ |

---

## 🔢 Calculation Formulas

```
Shortage Qty = PO Qty - Received Qty (if received < PO)
Overage Qty = Received Qty - PO Qty (if received > PO)

Validation: Received Qty = Accepted Qty + Rejected Qty

PO Balance = PO Qty - Total Accepted Qty
- If Balance > 0 → PO Status: OPEN
- If Balance = 0 → PO Status: CLOSED
- If Balance < 0 → PO Status: EXCESS (needs review)
```

---

## 🚀 Quick API Usage

### 1️⃣ Create GRN with Items
```bash
curl -X POST http://localhost:5000/api/grn-items/create-with-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "poId": 5,
    "grnDate": "2026-01-07",
    "notes": "Delivery from vendor",
    "items": [
      {
        "poItemId": 10,
        "poQty": 100,
        "receivedQty": 95,
        "acceptedQty": 95,
        "rejectedQty": 0,
        "remarks": "2 short"
      }
    ]
  }'
```

### 2️⃣ Check PO Balance
```bash
curl -X GET http://localhost:5000/api/grn-items/po/5/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3️⃣ Approve Excess Quantity
```bash
curl -X POST http://localhost:5000/api/grn-items/44/approve-excess \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approvalNotes": "Approved by manager"}'
```

### 4️⃣ Get GRN Summary
```bash
curl -X GET http://localhost:5000/api/grn-items/15/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5️⃣ View Inventory Ledger
```bash
curl -X GET http://localhost:5000/api/grn-items/15/inventory-ledger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🗂️ Database Migration

Before using, run:
```sql
-- Option 1: Via MySQL
mysql -u root -p database_name < backend/migrations/003-grn-item-logic.sql

-- Option 2: Manually copy SQL and run in your DB client
-- File: backend/migrations/003-grn-item-logic.sql
```

---

## 💡 Use Cases

### Case 1: Partial Delivery (Shortage)
```
PO: 100 units
Received: 95 units
Status: SHORT_RECEIPT
Inventory: +95
PO: OPEN for remaining 5 units
```

### Case 2: Quality Rejection
```
PO: 50 units
Received: 50, Accepted: 48, Rejected: 2
Status: REJECTED
Inventory: +48
Rejected Qty: Tracked separately (awaiting return)
```

### Case 3: Excess Receipt
```
PO: 25 units
Received: 30 units
Status: EXCESS_HOLD
Manager approves → EXCESS_ACCEPTED
Inventory: +30 (or stays at 25 if rejected)
```

---

## 🎓 Key Rules (REMEMBER)

1. ✅ **Only Accepted Qty** → Inventory
2. ✅ **Rejected Qty** → Tracked separately (NOT in stock)
3. ✅ **Shortage Qty** → PO stays open
4. ✅ **Excess** → Requires manager approval
5. ✅ **PO Closes** when Total Accepted = Total Ordered

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| GRN creation fails | Check poId exists & items array not empty |
| Qty validation error | Ensure: Received = Accepted + Rejected |
| Inventory not updating | Verify accepted_qty > 0 |
| Can't approve excess | GRN item status must be EXCESS_HOLD first |
| Balance calculation wrong | Check if only accepted_qty counted (rejected excluded) |

---

## 📊 Files Created

1. **Services**
   - `grnItemService.js` - Core GRN logic
   - `inventoryPostingService.js` - Stock posting
   - `poBalanceService.js` - Balance calculations

2. **Controllers**
   - `grnItemController.js` - API handlers

3. **Routes**
   - `grnItemRoutes.js` - Endpoints

4. **Database**
   - `migrations/003-grn-item-logic.sql` - Tables & schema

5. **Documentation**
   - `GRN_ITEM_LOGIC.md` - Full guide
   - `GRN_QUICK_REFERENCE.md` - This file

---

## ✨ Next Steps

1. Run database migration
2. Test API with sample data
3. Integrate with frontend forms
4. Set up manager approval UI
5. Monitor dashboard metrics

---

## 📞 Support

For detailed information, see: `docs/GRN_ITEM_LOGIC.md`
