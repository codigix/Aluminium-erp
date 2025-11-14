# 🚀 RFQ Quick Start - First Time Use

## ⚡ 5-Minute Setup

### Step 1: Start the Application
```bash
# Terminal 1 - Backend (already running on port 5000)
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Check:** Visit http://localhost:5173 in browser

---

## 📋 Create Your First RFQ - Complete Example

### Example: Aluminum Ingot Quote Request

**Goal**: Send a quote request for 500 KG of Aluminium Ingot to 2 suppliers

### Step-by-Step:

#### 1️⃣ **Go to RFQ Module**
```
URL: http://localhost:5173/buying/rfqs
Look for: "+ New RFQ" button
```

#### 2️⃣ **Select Created By**
```
Click dropdown: "Created By"
Select: "John Procurement"
```

#### 3️⃣ **Set Valid Till Date**
```
Click "Valid Till" field
Select: Any date 2+ weeks from today
Example: 2025-11-20
```

#### 4️⃣ **Add Items**
```
Items automatically shown if available.
If not, you can:
- Load from Material Request (if available)
- Or manually enter items
```

**Our Sample Items:**
- ✅ ITEM-001 - Aluminium Ingot (KG)
- ✅ ITEM-002 - Copper Sheet (SHEET)
- ✅ ITEM-003 - Stainless Steel Rod (ROD)

#### 5️⃣ **Add Suppliers**
```
Click supplier dropdown
Select: Any active supplier
Click: "Add Supplier"
Repeat: For 2-3 suppliers
```

#### 6️⃣ **Save RFQ**
```
Click: "Save" button
Expected: "RFQ created successfully" message
```

**Your RFQ is now in DRAFT status** ✅

---

## ✉️ Send the RFQ to Suppliers

#### 7️⃣ **Return to RFQ List**
```
URL: http://localhost:5173/buying/rfqs
Find: Your newly created RFQ
```

#### 8️⃣ **Send to Suppliers**
```
Click: "Send" button on your RFQ row
Expected: Status changes from "draft" → "sent"
```

**RFQ is now sent** ✅

---

## 📊 View Supplier Responses

#### 9️⃣ **Check Responses**
```
Click: "Responses" button
See: All supplier quotations (if received)
```

---

## 🎯 Common Use Cases

### Use Case 1: Bulk Order RFQ
```
Created By: Procurement Manager
Valid Till: 30 days from today
Items: Multiple items (10+ units)
Suppliers: 3-4 competing suppliers
Goal: Get best price and terms
```

### Use Case 2: Emergency Order
```
Created By: Supply Manager
Valid Till: 7 days from today
Items: Single critical item
Suppliers: 2-3 pre-qualified suppliers
Goal: Quick availability check
```

### Use Case 3: Regular Replenishment
```
Created By: Procurement Officer
Valid Till: 45 days from today
Items: Standard items list
Suppliers: Regular vendors
Goal: Compare pricing and lead times
```

---

## 🔍 Sample Data Available

### Contacts (Created By):
```
1. John Procurement     (john@company.com)
2. Sarah Supply         (sarah@company.com)
3. Mike Buyer          (mike@company.com)
```

### Items Available:
```
1. ITEM-001 - Aluminium Ingot (KG)
2. ITEM-002 - Copper Sheet (SHEET)
3. ITEM-003 - Stainless Steel Rod (ROD)
4. ITEM-004 - Packaging Box (BOX)
5. ITEM-005 - Labels (ROLL)
```

### Supplier Groups:
```
1. Raw Materials
2. Finished Goods
3. Services
4. Equipment
5. Packaging
```

---

## ✅ Checklist Before Creating RFQ

- [ ] Suppliers created (at least 2)
- [ ] Items created (at least 1)
- [ ] Contacts created (at least 1)
- [ ] Know the items you need to quote
- [ ] Know the suppliers to approach
- [ ] Know the validity period needed

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Created By" empty | Create contacts first |
| "No suppliers" | Create suppliers with GSTIN |
| "No items" | Create items in Items module |
| "Cannot send RFQ" | RFQ must be in Draft status |
| "Cannot update RFQ" | Only Draft RFQs can be edited |

---

## 📱 Where to Find RFQ Module

### From Sidebar:
```
Buying Module
├── Suppliers
├── Material Request
├── RFQ ← You are here
├── Purchase Orders
└── ...
```

### Direct Link:
```
http://localhost:5173/buying/rfqs
```

---

## 🎬 RFQ Workflow Summary

```
┌─────────────┐
│   START     │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Create RFQ      │ ← Step 1-6
│ (Draft Status)   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Send RFQ        │ ← Step 7-8
│ (Sent Status)    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Receive Responses│ ← Step 9
│ (Responses Status)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Close RFQ       │
│ (Closed Status)  │
└──────┬───────────┘
       │
       ▼
┌─────────────┐
│     END     │
└─────────────┘
```

---

## 📞 API Quick Reference

### Create RFQ
```bash
curl -X POST http://localhost:5000/api/rfqs \
  -H "Content-Type: application/json" \
  -d '{
    "created_by_id": "CONT-001",
    "valid_till": "2025-11-20",
    "items": [{"item_code": "ITEM-001", "qty": 100, "uom": "KG"}],
    "suppliers": [{"supplier_id": "SUP-1730000000000"}]
  }'
```

### List RFQs
```bash
curl http://localhost:5000/api/rfqs
```

### Send RFQ
```bash
curl -X PATCH http://localhost:5000/api/rfqs/RFQ-1730000000000/send
```

---

## 🎓 Key Concepts

### RFQ Status Flow
- **Draft**: Being prepared, not yet sent
- **Sent**: Sent to suppliers, awaiting quotes
- **Responses Received**: Suppliers submitted quotes
- **Closed**: RFQ process complete

### When Can You...?

| Action | In Draft | In Sent | In Responses | In Closed |
|--------|----------|---------|--------------|-----------|
| Edit | ✅ | ❌ | ❌ | ❌ |
| Send | ✅ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |
| View | ✅ | ✅ | ✅ | ✅ |
| Close | ✅ | ✅ | ✅ | ❌ |

---

## 🎯 Next: Supplier Quotations

After sending RFQ, suppliers can respond with quotations:

1. **Supplier logs in** (if available)
2. **Views RFQ details**
3. **Submits quotation** with pricing
4. **You receive response** → Status changes to "responses_received"

---

## 💾 Sample RFQ Creation - Copy & Paste

**Save this for reference:**

```
Created By: John Procurement
Valid Till: 2025-11-20
Items:
  - ITEM-001: 500 KG
  - ITEM-002: 100 SHEET
Suppliers:
  - Supplier A
  - Supplier B
```

---

## ✨ Advanced Features

Once you master the basics:

1. **Load from Material Request** - Auto-populate items
2. **Filter by Status** - Draft, Sent, Responses Received, Closed
3. **Search** - Find RFQs by ID
4. **View Responses** - Compare supplier quotes
5. **Export** - (if feature available)

---

## 🚀 Ready to Go!

You now have everything needed to:
- ✅ Create RFQs
- ✅ Manage suppliers
- ✅ Track quotations
- ✅ Make procurement decisions

**Start by clicking "+ New RFQ" button!**

---

**Version**: 1.0
**Last Updated**: 2025-10-31
**Status**: ✅ PRODUCTION READY