# 🎯 GRN Form with Purchase Order Selection - Complete Guide

## Overview

The **Create Goods Receipt Note (GRN)** form has been enhanced with automatic Purchase Order selection. When you select a PO, all items from that PO automatically populate, showing:
- Item codes and names
- Quantities ordered
- Ready for you to enter quantities received

---

## 📋 Step-by-Step Usage

### **Step 1: Navigate to Goods Receipt Notes Page**
1. Go to `http://localhost:5173/buying/purchase-receipts`
2. Click the **"Create GRN"** button
3. Modal opens: **"📦 Create Goods Receipt Note (GRN)"**

### **Step 2: Select a Purchase Order**
1. Look for the **"Purchase Order *"** dropdown
2. Click it to see list of available POs:
   - Shows only POs that are `draft`, `submitted`, `to_receive`, or `partially_received`
   - Each PO shows: `PO-NO - SUPPLIER_NAME`
   - Example: `PO-1733221234 - Company A`
3. **Select a PO**

### **Step 3: Verify Supplier Info**
After selecting a PO, you'll see a blue box with:
- 🏢 **Supplier:** [Supplier Name]
- This confirms the correct supplier is selected

### **Step 4: Set Receipt Date**
1. **Receipt Date*** field auto-sets to today
2. Change if needed (use date picker)

### **Step 5: Items Auto-Populate**
When you select a PO, all items from that PO appear in the table:

| Item Code & Name | Qty Ordered | Qty Received | Remarks |
|---|---|---|---|
| ITEM-001 | 10 | [input] | [optional] |
| ITEM-002 | 5 | [input] | [optional] |

**Column Details:**
- **Item Code & Name**: Read-only, shows code and description from PO
- **Qty Ordered**: Read-only, shows what was ordered
- **Qty Received**: Enter actual quantity you received (editable)
- **Remarks**: Optional, note any issues (damaged, missing, etc.)

### **Step 6: Enter Quantities Received**
For each item, enter the quantity you actually received:
1. Click in "Qty Received" field
2. Enter number (can be decimal: 10.5)
3. Leave blank or "0" if not received
4. Tab to next field

### **Step 7: Add Optional Remarks**
For each item with issues:
1. Click in "Remarks" field
2. Type issue: "Damaged packaging", "Short quantity", etc.
3. Leave empty if no issues

### **Step 8: Review Summary**
Bottom of form shows:
- **Total Items:** Count of items from PO
- **Total Quantity:** Sum of all quantities received
- Example: `Total Items: 2 | Total Quantity: 15 units`

### **Step 9: Submit**
1. Click **"✓ Create GRN"** button (blue)
2. **Expected:**
   - Modal closes
   - GRN created with status "draft"
   - Returns to GRN list page
   - New GRN appears in table

---

## ✅ Complete Example Workflow

### **Scenario: Receive goods for PO-1733221234**

```
Step 1: Open Goods Receipt Notes page
        http://localhost:5173/buying/purchase-receipts

Step 2: Click "Create GRN" button
        Modal opens

Step 3: Select Purchase Order
        Dropdown → Select "PO-1733221234 - Company A"
        
Step 4: Verify Supplier
        See: 🏢 Supplier: Company A
        
Step 5: Receipt Date
        Auto-filled with today's date
        
Step 6: Items appear:
        Item Code & Name     | Qty Ordered | Qty Received | Remarks
        ITEM-001 (Widget A)  |     10      |     [blank]  | 
        ITEM-002 (Widget B)  |      5      |     [blank]  |
        
Step 7: Enter Quantities Received
        ITEM-001: Enter 10 (full quantity received)
        ITEM-002: Enter 4 (short 1 unit - damaged)
        
Step 8: Add Remarks
        ITEM-002 remarks: "1 unit damaged"
        
Step 9: Review Summary
        Shows: Total Items: 2 | Total Quantity: 14 units
        
Step 10: Submit
        Click "✓ Create GRN"
        Modal closes
        
Result: GRN created with:
- PO: PO-1733221234
- Supplier: Company A
- Items: 2
- Total Received: 14 units
- Status: DRAFT
```

---

## 🎨 Form Layout

```
┌─────────────────────────────────────────┐
│  📦 Create Goods Receipt Note (GRN)     │
├─────────────────────────────────────────┤
│                                         │
│  [Purchase Order Dropdown] [Date Picker]│
│  Select PO                Receipt Date  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 🏢 Supplier: Company A           │  │
│  └──────────────────────────────────┘  │
│                                         │
│  📦 Received Items                      │
│  ┌──────────────────────────────────┐  │
│  │ Item | Qty Ord | Qty Rec | Rem   │  │
│  ├──────────────────────────────────┤  │
│  │ A101 │   10   │   [_]  │  [__]  │  │
│  │ A102 │    5   │   [_]  │  [__]  │  │
│  └──────────────────────────────────┘  │
│  [+ Add Item]                           │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Total Items: 2 | Total Qty: 15   │  │
│  └──────────────────────────────────┘  │
│                                         │
│              [Cancel] [Create GRN]     │
└─────────────────────────────────────────┘
```

---

## 🔍 Feature Details

### **Auto-Population**
When you select a PO:
1. ✅ Supplier name appears
2. ✅ All items from that PO load
3. ✅ Quantities ordered are shown
4. ✅ Ready for you to enter received quantities

### **Item Comparison**
For each item, you can easily see:
- **What was ordered** (Qty Ordered column)
- **What you received** (Qty Received field)
- **Differences** (e.g., 10 ordered but only 9 received)

### **Optional Remarks**
Use remarks to document:
- Damaged items
- Wrong color/specification
- Expired products
- Missing items
- Quantity short
- Quality issues
- Any other notes for QC inspection

### **Summary Updates**
As you enter quantities, the summary automatically updates:
- Total qty changes as you type
- Shows real-time count

---

## 🎯 Quick Actions

### **Change PO**
1. Click on Purchase Order dropdown again
2. Select different PO
3. Items automatically update

### **Add Extra Item**
If PO doesn't have all items:
1. Click **"+ Add Item"** button
2. Manually enter item code and quantity
3. (Usually not needed if PO has correct items)

### **Remove Item**
1. Click trash icon 🗑️ on item row
2. Item removed from GRN

### **Start Over**
1. Click **"Cancel"** button
2. Modal closes without saving
3. Click "Create GRN" again to start fresh

---

## 📊 Data Saved

When you create a GRN, the system saves:

```
Goods Receipt Note (GRN):
├── GRN Number: GRN-XXXXXXXXXXXX (auto-generated)
├── PO Reference: PO-1733221234
├── Supplier: Company A
├── Receipt Date: 2024-12-04
├── Status: DRAFT
└── Items:
    ├── ITEM-001: Qty Received: 10
    ├── ITEM-002: Qty Received: 4
    └── Created at: [timestamp]
```

---

## ✨ Benefits of This Approach

### **Better UX**
- No manual item entry needed
- Auto-populated from PO
- Less chance of errors
- Clear comparison of ordered vs received

### **Time Saving**
- Select PO once
- All items load automatically
- Just enter quantities and submit

### **Data Accuracy**
- Item details come directly from PO
- Supplier auto-selected correctly
- Less manual data entry = fewer errors

### **Audit Trail**
- GRN links to PO
- Can trace goods back to original order
- Complete history maintained

---

## 🧪 Test Scenarios

### **Test 1: Normal Receipt**
- Select any PO with items
- Enter received quantities (same as ordered)
- Create GRN
- ✅ Should create successfully

### **Test 2: Partial Receipt**
- Select PO
- Enter less quantity than ordered
- Add remarks explaining shortage
- Create GRN
- ✅ Should create with lower quantity

### **Test 3: Quality Issues**
- Select PO
- Enter all quantities
- Add remarks: "Items damaged in shipping"
- Create GRN
- ✅ Should record issues for QC inspection

### **Test 4: Change PO**
- Select one PO (see items)
- Change dropdown to different PO
- ✅ Items should update automatically

### **Test 5: No PO Selected**
- Leave PO dropdown empty
- Try to submit
- ✅ Should show error: "Please fill in all required fields"

---

## 🐛 Troubleshooting

### **Problem: No POs in dropdown**
**Solution:**
1. Go to Purchase Orders page
2. Create some POs first
3. POs must have status: draft, submitted, to_receive, or partially_received
4. Return to GRN form, dropdown should show them

### **Problem: Items don't appear**
**Solution:**
1. Select a PO from the dropdown
2. Wait a moment for items to load
3. If still blank, the PO might have no items
4. Try selecting a different PO

### **Problem: Can't submit form**
**Solution:**
1. Check all required fields are filled:
   - ✓ Purchase Order selected
   - ✓ Receipt Date set
   - ✓ At least one item with Qty Received > 0
2. Click submit again
3. Should show specific error message if missing something

### **Problem: Supplier name shows wrong**
**Solution:**
1. The supplier comes from the PO
2. Verify PO was created with correct supplier
3. If wrong supplier, delete GRN and create new one for correct PO

### **Problem: GRN created but not in list**
**Solution:**
1. Refresh the page
2. Check filters (status dropdown)
3. GRN should appear with status "DRAFT"

---

## 📱 Next Steps After Creating GRN

Once GRN is created:

1. **View GRN Details**
   - Click on GRN in list
   - See all items and quantities

2. **Inspect Items**
   - Inspect goods for quality/damage
   - Update accepted/rejected quantities

3. **Accept GRN**
   - If all goods are good
   - Click "Accept" to move to inventory

4. **Reject Items**
   - If items are damaged/wrong
   - Record rejection and send back

5. **Create Invoice**
   - After accepting GRN
   - Create Purchase Invoice for payment

---

## 💡 Pro Tips

1. **Review PO First**
   - Before creating GRN, review PO details
   - Ensure you know what's expected

2. **Record Issues Immediately**
   - Note any damage/shortage in remarks
   - Don't delay quality inspection

3. **Compare Quantities**
   - Look at both "Qty Ordered" and "Qty Received"
   - Easy to spot short deliveries

4. **Add Remarks for Later**
   - Remarks help QC and Finance teams
   - Provides audit trail

5. **Check Receipt Date**
   - Defaults to today
   - Change if goods received on different date

---

## 🔗 Related Workflows

```
Purchase Order Created (DRAFT)
         ↓
Purchase Order Submitted
         ↓
Create GRN ← YOU ARE HERE
         ↓
Inspect & Accept GRN
         ↓
Create Purchase Invoice
         ↓
Invoice Submitted
         ↓
Payment Made
```

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all fields are correctly filled
3. Check browser console for errors (F12)
4. Ensure backend is running (port 5000)
5. Try refreshing the page

---

**Ready to receive goods? Start with Step 1 above!** 🚀