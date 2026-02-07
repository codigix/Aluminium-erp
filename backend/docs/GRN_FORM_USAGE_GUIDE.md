# GRN Processing Form - User Guide

## 🎯 Overview

The Enhanced GRN Processing form (`GRNProcessing.jsx`) provides a complete item-wise goods receipt processing system with:
- Auto-fetch PO items when PO is selected
- Item-wise data entry (Received, Accepted, Rejected quantities)
- Real-time validation and status calculation
- Shortage, Overage & Rejection detection
- Single-click GRN creation with full inventory posting

---

## 📱 Form Layout

```
┌─────────────────────────────────────────────────────────┐
│  CREATE GRN (GOODS RECEIVED NOTE)                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HEADER SECTION                                        │
│  ┌─────────────────┬────────────┬────────────────┐     │
│  │ PO Selection *  │ GRN Date * │ Notes (Opt)    │     │
│  ├─────────────────┼────────────┼────────────────┤     │
│  │ [Dropdown ▼]    │ [Date]     │ [Text Input]   │     │
│  └─────────────────┴────────────┴────────────────┘     │
│                                                         │
│  ITEMS SECTION (Auto-populated when PO selected)       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Item Code | Description | PO Qty | Received ... │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ ITEM001   | Component A | 100    | [  ]  ...   │  │
│  │ ITEM002   | Component B | 50     | [  ]  ...   │  │
│  │ ITEM003   | Component C | 25     | [  ]  ...   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ACTIONS SECTION                                       │
│  [Cancel]  [Create GRN]                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Step-by-Step Usage

### Step 1: Open GRN Processing
```
Sidebar → Inventory → GRN Processing
```

### Step 2: Click "Create GRN" Button
```
Green button in the top-right
```

### Step 3: Select Purchase Order
```
Click dropdown "Select PO..."
Choose: PO-2026-0001
```
**What happens automatically:**
- Form fetches all items from this PO
- Items table is populated
- Each item shows:
  - Item Code
  - Description
  - PO Quantity (ordered amount)
  - Ready for input fields (Received, Accepted, Rejected)

### Step 4: Enter Quantities for Each Item

#### Column Headers:
```
┌─────────────┬──────────────┬──────────────┬───────────────┐
│ Received *  │ Accepted *   │ Rejected *   │ Remarks       │
├─────────────┼──────────────┼──────────────┼───────────────┤
│ [Number]    │ [Number]     │ [Number]     │ [Text Notes]  │
└─────────────┴──────────────┴──────────────┴───────────────┘
```

#### Entry Rules:
```
**MANDATORY VALIDATION:**
Received Qty = Accepted Qty + Rejected Qty

Examples:
✓ Received: 100  =  Accepted: 100  +  Rejected: 0    ✓ VALID
✓ Received: 95   =  Accepted: 95   +  Rejected: 0    ✓ VALID
✓ Received: 50   =  Accepted: 48   +  Rejected: 2    ✓ VALID
✗ Received: 100  =  Accepted: 95   +  Rejected: 0    ✗ INVALID (5 missing)
✗ Received: 50   =  Accepted: 50   +  Rejected: 2    ✗ INVALID (2 extra)
```

---

## 📊 Real-Time Status Calculation

As you enter quantities, the system auto-calculates:

### Status Meanings:

| Status | Meaning | When | Color |
|--------|---------|------|-------|
| **PENDING** | No data yet | When no quantities entered | Gray |
| **RECEIVED** | Perfect receipt | Received = PO & Rejected = 0 | Green |
| **SHORT_RECEIPT** | Less received | Received < PO | Yellow |
| **REJECTED** | Has damaged items | Rejected > 0 | Red |
| **EXCESS_HOLD** | More received, awaiting approval | Received > PO | Orange |

### Example Calculations:

#### Item A: Shortage
```
PO Qty:        100
You Enter:     Received: 95, Accepted: 95, Rejected: 0

Auto-Calculated:
├─ Shortage: 5 (100 - 95)
├─ Status: SHORT_RECEIPT (yellow)
└─ Meaning: 5 units still pending from vendor
```

#### Item B: Rejection
```
PO Qty:        50
You Enter:     Received: 50, Accepted: 48, Rejected: 2

Auto-Calculated:
├─ Status: REJECTED (red)
├─ Meaning: 2 units damaged, awaiting replacement
└─ Inventory Will Receive: 48 units only
```

#### Item C: Overage
```
PO Qty:        25
You Enter:     Received: 30, Accepted: 25, Rejected: 0

Auto-Calculated:
├─ Overage: 5 (30 - 25)
├─ Status: EXCESS_HOLD (orange)
└─ Meaning: 5 extra units - awaiting manager approval
```

---

## ✅ Validation & Error Handling

### Before Submission:

The form checks:
1. ✓ PO is selected
2. ✓ All items have entries
3. ✓ Received = Accepted + Rejected for each item
4. ✓ All quantities are valid numbers

### If Errors Found:

```
❌ Validation Error
┌─────────────────────────────────────────┐
│ Please fix errors in the form            │
├─────────────────────────────────────────┤
│ ITEM001: Received (95) must equal       │
│          Accepted (95) + Rejected (0)   │
│                                         │
│ ITEM002: Received Qty required          │
├─────────────────────────────────────────┤
│              [OK]                        │
└─────────────────────────────────────────┘

Form rows with errors turn red ⚠️
```

### Rows Highlighted:
```
If error, row background changes to light red (bg-red-50)
Error message shown in section below table
```

---

## 🔐 Submission & Processing

### Click "Create GRN"

The system:
1. ✓ Validates all data
2. ✓ Calculates metrics (shortage, overage, status)
3. ✓ Submits to API: `POST /api/grn-items/create-with-items`
4. ✓ Backend processes item-wise logic
5. ✓ Inventory posted (only accepted quantities)
6. ✓ PO balance updated automatically
7. ✓ Excess items placed in HOLD status

### Response:

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

### Success Message:

```
✅ GRN created successfully (GRN ID: 15)

[OK]
```

### Form Resets:
- All fields cleared
- Ready for next GRN

---

## 📋 Complete Example Workflow

### Scenario: Vendor sends partial delivery with some damage and excess

```
STEP 1: Select PO
┌─────────────────────────┐
│ Purchase Order *        │
│ [PO-2026-0001 ▼]        │
└─────────────────────────┘

STEP 2: GRN Date & Notes
┌────────────────┬──────────────────────────┐
│ GRN Date *     │ Notes (Optional)          │
│ [07/01/2026]   │ First delivery - partial  │
└────────────────┴──────────────────────────┘

STEP 3: Enter Item Quantities

Item A (Shortage Case):
┌───────┬─────────┬─────────┬────────────┬──────────────────────┐
│Item   │ PO Qty  │Received │ Accepted   │ Rejected   │ Status   │
├───────┼─────────┼─────────┼────────────┼────────────┼──────────┤
│ITEM001│   100   │   95    │    95      │     0      │SHORT(5)  │
└───────┴─────────┴─────────┴────────────┴────────────┴──────────┘
Remarks: "2 units short as per packing list"

Item B (Rejection Case):
┌───────┬─────────┬─────────┬────────────┬────────────┬──────────┐
│Item   │ PO Qty  │Received │ Accepted   │ Rejected   │ Status   │
├───────┼─────────┼─────────┼────────────┼────────────┼──────────┤
│ITEM002│    50   │   50    │    48      │     2      │REJECTED  │
└───────┴─────────┴─────────┴────────────┴────────────┴──────────┘
Remarks: "2 units found damaged during inspection"

Item C (Overage Case):
┌───────┬─────────┬─────────┬────────────┬────────────┬──────────┐
│Item   │ PO Qty  │Received │ Accepted   │ Rejected   │ Status   │
├───────┼─────────┼─────────┼────────────┼────────────┼──────────┤
│ITEM003│    25   │   30    │    25      │     0      │EXCESS(5) │
└───────┴─────────┴─────────┴────────────┴────────────┴──────────┘
Remarks: "5 extra units - awaiting approval"

STEP 4: Click "Create GRN"
┌─────────────┐  ┌──────────────┐
│   Cancel    │  │  Create GRN  │
└─────────────┘  └──────────────┘
                       ↓
                Processing...
                       ↓
                ✅ GRN created successfully
                   (GRN ID: 15)

RESULT:
✓ GRN-15 created
✓ Inventory Posted: 95 + 48 = 143 units
✓ Rejected Items: 2 units tracked (awaiting return)
✓ Excess Items: 5 units on HOLD (awaiting manager approval)
✓ PO Status: PARTIALLY_RECEIVED
✓ Dashboard updated
```

---

## 🎨 UI Features

### Color Indicators:

| Color | Meaning |
|-------|---------|
| 🟢 **Green** | Item fully received & accepted |
| 🟡 **Yellow** | Item short (less than ordered) |
| 🔴 **Red** | Item has rejections/damage |
| 🟠 **Orange** | Item excess (more than ordered) |
| ⚫ **Gray** | No data yet (pending) |

### Input Fields:

```
Number inputs only:
├─ Received Qty:  0-999 (required)
├─ Accepted Qty:  0-999 (required)
├─ Rejected Qty:  0-999 (required)
└─ Remarks:       Text field (optional)
```

### Form States:

```
NORMAL STATE: White background, blue focus ring
ERROR STATE: Light red background, error message shown
LOADING STATE: Button shows "Creating GRN..." and is disabled
```

---

## 🔍 Viewing Created GRNs

### GRN List View:

After creating a GRN, you'll see it in the table:

```
┌─────┬────────────────┬─────────────┬──────────────┬──────────┐
│ ID  │ PO Number      │ GRN Date    │ Received Qty │ Status   │
├─────┼────────────────┼─────────────┼──────────────┼──────────┤
│ 15  │ PO-2026-0001   │ 07/01/2026  │      175     │ RECEIVED │
│ 14  │ PO-2026-0001   │ 06/28/2026  │       50     │ RECEIVED │
└─────┴────────────────┴─────────────┴──────────────┴──────────┘
```

### Search:

```
Search PO number... [PO-2026-0001 ___________]
                        ↓
Filters GRNs by PO number in real-time
```

### Delete GRN:

```
Click 🗑 button
        ↓
Confirmation: "Delete GRN? This action cannot be undone"
        ↓
[Cancel]  [Delete]
```

---

## 🚀 Advanced: After GRN Creation

### Check PO Balance:

```bash
GET /api/grn-items/po/{poId}/balance
```

You'll see:
- Remaining quantities for each item
- Which items are OPEN vs CLOSED
- Which items need manager approval

### Approve Excess (if any):

```bash
POST /api/grn-items/{grnItemId}/approve-excess
{
  "approvalNotes": "Approved for future use"
}
```

### View Inventory Posted:

```bash
GET /api/grn-items/{grnId}/inventory-ledger
```

Shows all items added to inventory + rejected qty tracking

---

## ✅ Best Practices

1. **Enter quantities carefully** - The validation is strict for good reason (prevents inventory errors)
2. **Use remarks field** - Document any issues (shortages, damages) for audit trail
3. **Complete one item at a time** - Reduces entry errors
4. **Review total before submitting** - Check calculated status for each item
5. **Keep PO nearby** - Reference packing list/invoice while entering
6. **Create one GRN per delivery** - Don't mix multiple vendor deliveries

---

## ❓ FAQs

**Q: What if I enter wrong quantities?**
A: Validation prevents submission. Correct the errors and try again.

**Q: Can I edit quantities after GRN creation?**
A: Create a new GRN for corrections. Old GRNs remain for audit trail.

**Q: What happens to rejected items?**
A: Tracked separately in inventory_postings. Not counted in stock.

**Q: How are excess items handled?**
A: Placed in EXCESS_HOLD. Manager must approve before they enter stock.

**Q: Does the form support multiple receipts for same PO?**
A: Yes! You can create multiple GRNs against one PO for partial/staged deliveries.

---

## 📞 Support

For issues:
1. Check validation error messages carefully
2. Verify PO exists and has items
3. Ensure you have proper permissions
4. Contact your admin if API errors occur

---

This is production-ready, enterprise GRN processing! 🎉
