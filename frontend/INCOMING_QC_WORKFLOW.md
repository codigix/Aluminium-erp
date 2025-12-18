# Incoming Quality Check (QC) - Complete Workflow

## 📋 Overview

The **Incoming Quality Checks** module handles material inspection from **GRN (Goods Received Note)** before stock acceptance. This document explains the complete workflow from GRN creation to stock release.

---

## 🔄 Complete ERP Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      GRN Created (Buying)                        │
│                   Status: Awaiting QC Inspection                 │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           Quality Officer Creates Incoming QC                    │
│     Selects GRN → Selects Template → Sets Sampling Plan         │
│           Status Changes to: In Progress                         │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           Inspector Executes Inspection                          │
│     Measures parameters → Records Pass/Fail → Remarks           │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
                    ┌────┴────┬──────────┐
                    ↓         ↓          ↓
            ┌───────────┐ ┌────────┐ ┌───────┐
            │  PASSED   │ │REJECTED│ │ HOLD  │
            └───────────┘ └────────┘ └───────┘
                    ↓         ↓          ↓
           ✓ Stock Open   ✗ Create    ⊘ CAPA
           ✓ Invoice OK    NCR        ⊘ Rework
           ✓ Inventory    ✗ Supplier  ⊘ Re-Inspect
               Release     Penalty       Later
```

---

## 🎯 Step-by-Step UI Usage

### **Step 1: Create Incoming QC**

**Location:** `/quality/checks?type=incoming`

**Button:** Top-right "Create Incoming QC"

```
Incoming Quality Checks
│
├─ [+ Create Incoming QC]  ← Click here
```

---

### **Step 2: GRN Selection Form**

**Form Section 1: GRN Selection**

- **Field:** GRN No (Dropdown/Searchable)
- **Source:** Only GRNs with status "Awaiting QC Inspection"
- **Auto-filled after selection:**
  - GRN Type (Normal / Subcontract)
  - Supplier Name
  - PO No
  - GRN Date

**Example:**
```
GRN Selection
┌─────────────────────────────────┐
│ Select GRN...                   │ ← Click to open
└─────────────────────────────────┘

After selection:
GRN No:        GRN-140
GRN Type:      Normal
Supplier:      ABC Aluminium Pvt Ltd
PO No:         PO-230
GRN Date:      18-Dec-2025
```

---

### **Step 3: Material Details (Auto-Populated)**

**Form Section 2: Material Details**

Once GRN selected, shows all items in that GRN:

| Item / Part Name | Drawing No | Batch No | Received Qty |
|------------------|-----------|----------|--------------|
| Aluminium Coil   | DWG-001   | BATCH-45 | 100 PCS      |
| T-Slot Frame     | DWG-002   | BATCH-46 | 50 PCS       |

---

### **Step 4: Inspection Setup**

**Form Section 3: Inspection Setup**

```
Inspection Template:     ┌──────────────────────┐
                        │ Select template...   │ ← Choose from list
                        └──────────────────────┘
                        Examples:
                        - Aluminium Coil QC
                        - Steel Frame QC
                        - Electronic Components QC

Sampling Plan:          ┌──────────────────────┐
                        │ AQL (Default)        │
                        │ 100% Inspection      │
                        │ Custom Sampling      │
                        └──────────────────────┘

Inspection Level:       ┌──────────────────────┐
                        │ Normal (Default)     │
                        │ Tightened            │
                        │ Reduced              │
                        └──────────────────────┘

Sampling Qty:           ┌──────────┐
                        │ 20       │ ← Number of items to inspect
                        └──────────┘

Inspector Name:         Current User (Auto)
```

---

### **Step 5: Inspection Parameters Preview**

**Form Section 4: Parameters Auto-Load**

Once template selected, shows all parameters from that template:

| Parameter | Specification | UOM |
|-----------|---------------|-----|
| Length   | 100 ± 0.5 mm | mm |
| Width    | 50 ± 0.3 mm | mm |
| Finish   | No scratches | Visual |
| Hardness | ≥ 60 | HRC |

**Note:** These are templates. Actual values filled during inspection execution.

---

### **Step 6: Submit Form - Two Options**

**Bottom Action Buttons:**

```
[ Cancel ]   [ Save Draft ]   [ Start Inspection ]
```

**Option A: Save Draft**
- Saves inspection with status = **"Pending"**
- Can edit later before starting
- Useful if setup needs approval

**Option B: Start Inspection**
- Immediately creates inspection with status = **"In Progress"**
- Inspector can start filling values right away
- Recommended workflow

---

## 📊 Table Display After Creation

Once inspection created, it appears in the main table:

| Inspection ID | GRN No | Supplier | Drawing No | Item | Batch | Recv Qty | Insp Qty | Status | Result | Action |
|---|---|---|---|---|---|---|---|---|---|---|
| QC-IN-00045 | GRN-140 | ABC Ltd | DWG-001 | Aluminium Coil | BATCH-45 | 100 | - | In Progress | - | **Inspect** |

---

## 🔍 Inspection Execution

### **Click "Inspect" Button**

Opens **Inspection Drawer** (Right-side panel) in **Edit Mode**

**What Inspector Does:**

1. **Fill Parameter Values**
   ```
   Parameter: Length
   Actual Value: [100.2] ← Input measured value
   Result: [Pass] ← Select Pass/Fail
   ```

2. **Set Quantities**
   ```
   Accepted Qty:  95 ← Items that passed
   Rejected Qty:  5  ← Items that failed
   Rework Qty:    0  ← Items for rework
   ```

3. **Overall Result**
   ```
   [ Pass ]        ← All parameters passed
   [ Fail / Reject ]← Any parameter failed
   [ On Hold ]     ← Requires review
   ```

4. **Add Remarks**
   ```
   Scratches observed on 3 units (rejected)
   Surface finish acceptable on accepted units
   ```

5. **Upload Evidence**
   ```
   [ Choose Files ]
   ✓ QC-Inspection-001.pdf
   ✓ Photo-1.jpg
   ✓ Photo-2.jpg
   ```

---

## ✅ Submit Inspection - What Happens?

### **Scenario A: PASSED**

**Inspector Action:**
- All parameters: Pass
- Overall Result: **Pass**
- Click "Submit Inspection"

**System Response:**
1. ✅ Inspection Status → **"Passed"**
2. ✅ GRN Status → **"QC Completed"**
3. ✅ Stock Available in Inventory
4. ✅ Invoice Release Eligible
5. ✅ Supplier Quality Score → Updated (positive)

**Next Steps (Auto-Triggered):**
```
Inventory Module → Stock Balance Updated
Accounts Module → Goods Received Note can be invoiced
Dashboard → Passed count increases
```

---

### **Scenario B: REJECTED**

**Inspector Action:**
- Any parameter: Fail
- Overall Result: **Fail / Reject**
- Click "Submit Inspection"

**System Response:**
1. ❌ Inspection Status → **"Rejected"**
2. ❌ GRN Status → **"QC Failed - Action Required"**
3. ❌ Stock Blocked (Cannot be used)
4. ❌ Invoice Blocked
5. ❌ NCR Form appears in drawer

**Inspector Creates NCR (Non-Conformance Report):**
```
Defect Type:         Dimensional
Severity:            Major
Description:         Samples exceed length specification
Immediate Action:    Segregate & Hold
Responsible Dept:    Buying
```

**System Response:**
```
✅ NCR Created (linked to inspection)
✅ Buying Notified → Contact Supplier
✅ Supplier Quality Score → Penalty Applied
✅ Quality Dashboard → NCR Count Updates
✅ Review & Action Module → CAPA Required
```

**Next Steps:**
```
Buying → Contact Supplier for Return/Credit
Quality → Create CAPA for root cause analysis
Inventory → Stock Quarantined
```

---

### **Scenario C: ON HOLD / REWORK**

**Inspector Action:**
- Some parameters: Unclear
- Overall Result: **On Hold**
- Click "Submit Inspection"

**System Response:**
1. ⊘ Inspection Status → **"On Hold"**
2. ⊘ GRN Status → **"Pending QC Review"**
3. ⊘ Stock Partially Blocked (some items OK)
4. ⊘ Requires Further Review

**Next Steps:**
```
Quality → Review & Action Module (CAPA)
Quality → Schedule Re-inspection
Inventory → Block specific batch until resolved
```

---

## 📋 Status Transitions

```
Creation
   ↓
Pending ─────→ In Progress ─────┬─────────────┐
   ↓               ↓             ↓             ↓
Draft            Inspector    Passed      Rejected
(Can edit)       Executes    (Stock OK)    (NCR?)
                   ↓             ↓
              Submit         Released
              Result

Status Values:
- pending       : Created but not started
- in_progress   : Inspection is being filled
- passed        : QC completed successfully
- rejected      : QC failed - NCR created
- on_hold       : Awaiting review/clarification
```

---

## 🎛️ Filter & Search

### **Search By:**
- Inspection ID (e.g., QC-IN-00045)
- GRN No (e.g., GRN-140)
- Drawing No (e.g., DWG-001)
- Item Name (e.g., Aluminium Coil)

### **Filter By:**
- **Status:** Pending / In Progress / Passed / Rejected / On Hold
- **Supplier:** Multiple suppliers
- **Date Range:** From date → To date

### **Clear Filters:**
- Single button clears all filters and search

---

## 📊 Quick Summary Panel

**Visible on right-bottom** (Incoming QC tab only):

```
Today's Incoming QC
───────────────────
🟡 Pending:    6
🔵 In Progress: 3
🟢 Passed:     18
🔴 Rejected:    2
🟠 On Hold:     1
───────────────────
Acceptance Rate: 90% (18/20)
Total Inspections: 30
```

---

## 🔗 Integration Points

### **From Quality Module:**

1. **GRN System**
   - Fetches GRNs awaiting QC
   - Updates GRN status after inspection

2. **Inspection Templates**
   - Auto-loads parameters
   - Defines acceptance criteria

3. **NCR Module (Non-Conformance)**
   - Creates NCR for rejected materials
   - Links to inspection record

### **To Other Modules:**

1. **Inventory**
   - Releases stock if Passed
   - Blocks stock if Rejected
   - Updates stock status

2. **Accounts (Finance)**
   - Enables invoice if Passed
   - Blocks invoice if Rejected

3. **Buying**
   - Notified of rejections
   - Contacts supplier for return/credit

4. **Dashboard**
   - QC metrics updated in real-time
   - Supplier quality scores updated

---

## 🎯 Best Practices

### **For QC Managers:**
1. ✅ Review pending inspections daily
2. ✅ Ensure sampling plan matches GRN type
3. ✅ Use tightened inspection for new suppliers
4. ✅ Monitor acceptance rate trends
5. ✅ Create CAPA for recurring defects

### **For Inspectors:**
1. ✅ Measure parameters accurately
2. ✅ Upload photographic evidence
3. ✅ Document remarks for traceability
4. ✅ Segregate rejected materials immediately
5. ✅ Complete inspection same day as GRN receipt

### **For Buying:**
1. ✅ Review supplier quality scores
2. ✅ Contact supplier for rejected GRNs within 24 hrs
3. ✅ Track return/credit notes
4. ✅ Evaluate supplier performance quarterly

---

## 📱 Mobile & Responsive Design

✅ Works on tablets (landscape mode recommended for table)
✅ Full functionality on desktop
✅ Filter panel responsive
✅ Inspection drawer mobile-friendly

---

## 🔒 Access Control

**Required Role:** `quality` or `admin`

Route protection enforced:
```javascript
/quality/checks  →  Requires Quality Officer role
```

---

## 🚀 Key Features Summary

| Feature | Description |
|---------|-------------|
| **GRN Selection** | Dropdown with search (Supplier, PO, GRN No) |
| **Template Binding** | Auto-load inspection parameters |
| **Sampling Plan** | AQL, 100%, or Custom |
| **Parameter Tracking** | Measured values + Pass/Fail |
| **Quantity Tracking** | Accepted/Rejected/Rework quantities |
| **Evidence Upload** | Attach PDF, images, documents |
| **NCR Auto-Link** | Create NCR for rejections |
| **Status Tracking** | Real-time status updates |
| **Supplier Scoring** | Auto-update supplier quality metrics |
| **Batch Traceability** | Link inspection to batch number |
| **Remarks & Comments** | Document observations |
| **Inventory Integration** | Auto-block/release stock |

---

## 🔧 API Endpoints Required

### **Backend APIs Needed**

```javascript
// GET: Fetch pending GRNs
GET /api/quality/pending-grns?type=incoming

// GET: GRN details
GET /api/quality/grn-details/{grnId}

// GET: Inspection templates
GET /api/quality/inspection-templates

// GET: Template parameters
GET /api/quality/templates/{templateId}/parameters

// POST: Create inspection
POST /api/quality/inspections/create

// POST: Submit inspection
POST /api/quality/inspections/{inspectionId}/submit

// POST: Create NCR
POST /api/quality/non-conformance

// GET: Fetch inspections
GET /api/quality/inspections?type=incoming
```

---

## 📝 Example Inspection Record

```json
{
  "inspection_id": "QC-IN-00045",
  "grn_id": "GRN-140",
  "grn_no": "GRN-140",
  "po_no": "PO-230",
  "supplier": "ABC Aluminium Pvt Ltd",
  "inspection_type": "incoming",
  "item_name": "Aluminium Coil",
  "drawing_no": "DWG-001",
  "batch_no": "BATCH-45",
  "received_qty": 100,
  "inspected_qty": 20,
  "accepted_qty": 19,
  "rejected_qty": 1,
  "status": "passed",
  "result": "pass",
  "inspector_name": "John Doe",
  "inspection_date": "2025-12-18T10:30:00Z",
  "template_id": "TPL-001",
  "parameters": {
    "Length": { "specification": "100 ± 0.5", "actual": "100.2", "result": "pass" },
    "Width": { "specification": "50 ± 0.3", "actual": "50.1", "result": "pass" }
  },
  "remarks": "All parameters within specification",
  "uploaded_files": ["QC-Inspection-001.pdf", "Photo-1.jpg"]
}
```

---

## 🎓 Training Checklist

- [ ] Create GRN in Buying module
- [ ] Navigate to Quality → Quality Checks → Incoming QC
- [ ] Click "Create Incoming QC"
- [ ] Select GRN from dropdown
- [ ] Select Inspection Template
- [ ] Set Sampling Plan & Level
- [ ] Click "Start Inspection"
- [ ] Fill parameter values
- [ ] Set Accepted/Rejected quantities
- [ ] Select Overall Result (Pass/Fail/Hold)
- [ ] Add remarks
- [ ] Upload evidence photos
- [ ] Submit inspection
- [ ] Verify status change
- [ ] Check Dashboard for metrics update
- [ ] Verify Inventory stock available/blocked

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| No GRNs showing in dropdown | Ensure GRN status is "Awaiting QC Inspection" in Buying |
| Template not loading parameters | Select template from dropdown, wait for API response |
| Inspector name showing as null | Logged-in user session required |
| Stock not released after passing | Check Inventory module API integration |
| NCR not created for rejections | Ensure /api/quality/non-conformance endpoint exists |

---

**Last Updated:** 18-Dec-2025  
**Version:** 1.0  
**Module Status:** Production Ready ✅
