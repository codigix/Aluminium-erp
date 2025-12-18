# Quality Checks - API Integration Guide

## 🔗 Frontend ↔ Backend Communication

This document outlines all API endpoints required for the **Quality Checks** module to function properly.

---

## 📋 API Endpoints Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/quality/pending-grns` | GET | Fetch GRNs pending QC inspection | **NEEDED** |
| `/api/quality/grn-details/{grnId}` | GET | Get full details of a GRN | **NEEDED** |
| `/api/quality/inspection-templates` | GET | List all inspection templates | **NEEDED** |
| `/api/quality/templates/{templateId}/parameters` | GET | Get parameters for a template | **NEEDED** |
| `/api/quality/inspections/create` | POST | Create new inspection record | **NEEDED** |
| `/api/quality/inspections/{inspectionId}/submit` | POST | Submit completed inspection | **NEEDED** |
| `/api/quality/inspections` | GET | Fetch inspections (with filters) | **NEEDED** |
| `/api/quality/non-conformance` | POST | Create NCR for rejection | **NEEDED** |

---

## 🔍 Detailed API Specifications

### **1. GET /api/quality/pending-grns**

**Purpose:** Fetch all GRNs awaiting QC inspection

**Query Parameters:**
```
type = incoming | in_process | final
```

**Response Example:**
```json
[
  {
    "id": 140,
    "grn_no": "GRN-140",
    "po_no": "PO-230",
    "supplier": "ABC Aluminium Pvt Ltd",
    "grn_type": "Normal",
    "grn_date": "2025-12-18",
    "status": "awaiting_qc",
    "total_items": 2,
    "total_qty": 150,
    "warehouse": "Main Store"
  },
  {
    "id": 141,
    "grn_no": "GRN-141",
    "po_no": "PO-231",
    "supplier": "XYZ Metals",
    "grn_type": "Normal",
    "grn_date": "2025-12-18",
    "status": "awaiting_qc",
    "total_items": 1,
    "total_qty": 50,
    "warehouse": "Main Store"
  }
]
```

**Status Code:** 200 OK

---

### **2. GET /api/quality/grn-details/{grnId}**

**Purpose:** Get complete details of a GRN including items

**Path Parameters:**
```
grnId = 140
```

**Response Example:**
```json
{
  "id": 140,
  "grn_no": "GRN-140",
  "po_no": "PO-230",
  "grn_type": "Normal",
  "supplier": "ABC Aluminium Pvt Ltd",
  "supplier_id": 5,
  "grn_date": "2025-12-18",
  "warehouse": "Main Store",
  "warehouse_id": 1,
  "status": "awaiting_qc",
  "items": [
    {
      "id": 1,
      "item_id": 10,
      "item_code": "ITEM-001",
      "item_name": "Aluminium Coil 5mm",
      "drawing_no": "DWG-001",
      "batch_no": "BATCH-45",
      "uom": "PCS",
      "qty": 100,
      "received_qty": 100,
      "pending_qty": 100,
      "part_no": "PT-001"
    },
    {
      "id": 2,
      "item_id": 11,
      "item_code": "ITEM-002",
      "item_name": "T-Slot Frame",
      "drawing_no": "DWG-002",
      "batch_no": "BATCH-46",
      "uom": "PCS",
      "qty": 50,
      "received_qty": 50,
      "pending_qty": 50,
      "part_no": "PT-002"
    }
  ]
}
```

**Status Code:** 200 OK  
**Error:** 404 Not Found if GRN doesn't exist

---

### **3. GET /api/quality/inspection-templates**

**Purpose:** Fetch all inspection templates

**Response Example:**
```json
[
  {
    "id": 1,
    "name": "Aluminium Coil QC",
    "description": "Quality inspection for aluminium coils",
    "type": "incoming",
    "status": "active",
    "created_date": "2025-01-15",
    "parameters_count": 5
  },
  {
    "id": 2,
    "name": "Steel Frame QC",
    "description": "Quality inspection for steel frames",
    "type": "incoming",
    "status": "active",
    "created_date": "2025-02-10",
    "parameters_count": 4
  },
  {
    "id": 3,
    "name": "Electronic Components QC",
    "description": "Quality inspection for electronic components",
    "type": "incoming",
    "status": "active",
    "created_date": "2025-03-05",
    "parameters_count": 7
  }
]
```

**Status Code:** 200 OK

---

### **4. GET /api/quality/templates/{templateId}/parameters**

**Purpose:** Get inspection parameters for a specific template

**Path Parameters:**
```
templateId = 1
```

**Response Example:**
```json
[
  {
    "id": 1,
    "name": "Length",
    "specification": "100 ± 0.5 mm",
    "uom": "mm",
    "type": "numeric",
    "lower_limit": 99.5,
    "upper_limit": 100.5,
    "acceptable_values": null
  },
  {
    "id": 2,
    "name": "Width",
    "specification": "50 ± 0.3 mm",
    "uom": "mm",
    "type": "numeric",
    "lower_limit": 49.7,
    "upper_limit": 50.3,
    "acceptable_values": null
  },
  {
    "id": 3,
    "name": "Finish",
    "specification": "No scratches",
    "uom": "Visual",
    "type": "visual",
    "lower_limit": null,
    "upper_limit": null,
    "acceptable_values": ["Pass", "Fail"]
  },
  {
    "id": 4,
    "name": "Hardness",
    "specification": "≥ 60 HRC",
    "uom": "HRC",
    "type": "numeric",
    "lower_limit": 60,
    "upper_limit": null,
    "acceptable_values": null
  },
  {
    "id": 5,
    "name": "Surface Finish",
    "specification": "Ra ≤ 3.2",
    "uom": "μm",
    "type": "numeric",
    "lower_limit": null,
    "upper_limit": 3.2,
    "acceptable_values": null
  }
]
```

**Status Code:** 200 OK  
**Error:** 404 Not Found if template doesn't exist

---

### **5. POST /api/quality/inspections/create**

**Purpose:** Create a new inspection record

**Request Body:**
```json
{
  "grn_id": 140,
  "inspection_type": "incoming",
  "inspection_template_id": 1,
  "sampling_plan": "aql",
  "inspection_level": "normal",
  "sampling_qty": 20,
  "inspector_name": "John Doe",
  "status": "in_progress"
}
```

**Response Example:**
```json
{
  "id": 45,
  "inspection_no": "QC-IN-00045",
  "grn_id": 140,
  "grn_no": "GRN-140",
  "po_no": "PO-230",
  "inspection_type": "incoming",
  "supplier": "ABC Aluminium Pvt Ltd",
  "item_name": "Aluminium Coil 5mm",
  "drawing_no": "DWG-001",
  "batch_no": "BATCH-45",
  "received_qty": 100,
  "sampling_qty": 20,
  "inspection_template_id": 1,
  "sampling_plan": "aql",
  "inspection_level": "normal",
  "inspector_name": "John Doe",
  "status": "in_progress",
  "created_date": "2025-12-18T10:30:00Z",
  "created_by": "john.doe@company.com"
}
```

**Status Code:** 201 Created  
**Error:** 400 Bad Request if GRN not found or invalid status

---

### **6. POST /api/quality/inspections/{inspectionId}/submit**

**Purpose:** Submit completed inspection with results

**Path Parameters:**
```
inspectionId = 45
```

**Request Body:**
```json
{
  "inspection_id": 45,
  "sampling_qty": 20,
  "accepted_qty": 19,
  "rejected_qty": 1,
  "rework_qty": 0,
  "overall_result": "pass",
  "remarks": "All parameters within specification. One unit with minor surface scratches rejected.",
  "parameters": {
    "Length": {
      "specification": "100 ± 0.5 mm",
      "actual_value": "100.2",
      "result": "pass"
    },
    "Width": {
      "specification": "50 ± 0.3 mm",
      "actual_value": "50.1",
      "result": "pass"
    },
    "Finish": {
      "specification": "No scratches",
      "actual_value": "Pass - one unit rejected",
      "result": "pass"
    },
    "Hardness": {
      "specification": "≥ 60 HRC",
      "actual_value": "62.5",
      "result": "pass"
    },
    "Surface Finish": {
      "specification": "Ra ≤ 3.2",
      "actual_value": "2.8",
      "result": "pass"
    }
  }
}
```

**Response Example:**
```json
{
  "id": 45,
  "inspection_no": "QC-IN-00045",
  "status": "passed",
  "result": "pass",
  "accepted_qty": 19,
  "rejected_qty": 1,
  "inspected_qty": 20,
  "inspection_date": "2025-12-18T10:30:00Z",
  "message": "Inspection submitted successfully. Stock released to inventory."
}
```

**Status Code:** 200 OK  
**Side Effects:**
- Updates GRN status to "QC Completed"
- If result = "pass" → Releases stock in Inventory
- If result = "fail" → Blocks stock, creates NCR prompt
- Updates Supplier Quality Score
- Triggers Accounts module (invoice eligibility)

---

### **7. GET /api/quality/inspections**

**Purpose:** Fetch inspections with filtering and pagination

**Query Parameters:**
```
type = incoming | in_process | final  (required)
status = pending | in_progress | passed | rejected | on_hold
supplier = ABC Aluminium
search = GRN-140  (searches inspection_no, grn_id, item_name, drawing_no)
date_from = 2025-12-01
date_to = 2025-12-31
limit = 50
offset = 0
```

**Response Example:**
```json
{
  "total": 45,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": 45,
      "inspection_no": "QC-IN-00045",
      "grn_id": "GRN-140",
      "supplier": "ABC Aluminium Pvt Ltd",
      "drawing_no": "DWG-001",
      "item_name": "Aluminium Coil 5mm",
      "batch_no": "BATCH-45",
      "received_qty": 100,
      "inspected_qty": 20,
      "status": "passed",
      "result": "pass",
      "inspection_date": "2025-12-18T10:30:00Z",
      "po_no": "PO-230"
    },
    {
      "id": 44,
      "inspection_no": "QC-IN-00044",
      "grn_id": "GRN-139",
      "supplier": "XYZ Metals",
      "drawing_no": "DWG-002",
      "item_name": "T-Slot Frame",
      "batch_no": "BATCH-44",
      "received_qty": 50,
      "inspected_qty": 15,
      "status": "rejected",
      "result": "fail",
      "inspection_date": "2025-12-17T14:20:00Z",
      "po_no": "PO-229"
    }
  ]
}
```

**Status Code:** 200 OK

---

### **8. POST /api/quality/non-conformance**

**Purpose:** Create a Non-Conformance Report (NCR) for rejected inspection

**Request Body:**
```json
{
  "inspection_id": 45,
  "defect_type": "Dimensional",
  "severity": "major",
  "description": "Samples exceed length specification by 0.8mm",
  "immediate_action": "Segregate and hold batch for further evaluation",
  "responsible_department": "buying",
  "root_cause": null,
  "corrective_action": null,
  "preventive_action": null,
  "target_date": null
}
```

**Response Example:**
```json
{
  "id": 78,
  "ncr_no": "NCR-2025-00078",
  "inspection_id": 45,
  "inspection_no": "QC-IN-00045",
  "grn_id": "GRN-140",
  "supplier": "ABC Aluminium Pvt Ltd",
  "defect_type": "Dimensional",
  "severity": "major",
  "description": "Samples exceed length specification by 0.8mm",
  "immediate_action": "Segregate and hold batch for further evaluation",
  "responsible_department": "buying",
  "status": "open",
  "created_date": "2025-12-18T10:35:00Z",
  "message": "NCR created successfully and linked to inspection"
}
```

**Status Code:** 201 Created  
**Side Effects:**
- Creates NCR record
- Links to inspection record
- Notifies Buying department
- Updates Supplier Quality Score (penalty)
- Blocks inventory stock
- Creates task in Review & Action module

---

## 🔄 Data Flow Diagram

```
Frontend (React)          Backend (Node.js)          Database (MySQL)
─────────────────────────────────────────────────────────────────

User clicks "Create QC"
    ↓
Drawer opens
    ↓
├─ GET /pending-grns ──────→ Query GRN table
                            (status = awaiting_qc)
    ↓                                ↓
Show GRN list ←──────────── Return GRN list
    ↓
User selects GRN
    ↓
├─ GET /grn-details/{id} ──→ Query GRN + items
    ↓                                ↓
Auto-fill form ←──────────── Return GRN details
    ↓
├─ GET /templates ────────→ Query templates table
    ↓                                ↓
Show template dropdown ←──── Return templates
    ↓
User selects template
    ↓
├─ GET /templates/{id}/params ─→ Query parameters
    ↓                                ↓
Show parameters table ←───── Return parameters
    ↓
User clicks "Start Inspection"
    ↓
├─ POST /inspections/create ─→ Insert inspection record
    ↓                                ↓
Create inspection ←────────── Return inspection_no
    ↓
Update table with new record
    ↓
User clicks "Inspect"
    ↓
Inspector fills form
    ↓
User clicks "Submit"
    ↓
├─ POST /inspections/{id}/submit ─→ Update inspection record
    ↓                                    ↓
                                   Update GRN status
                                   Update inventory
    ↓                                    ↓
Show success ←──────────────── Return updated status
    ↓
Trigger stock release / NCR creation
```

---

## 🔐 Authentication & Authorization

**All endpoints require:**
- JWT Token in Authorization header
- User must have role: `quality` or `admin`

```
Authorization: Bearer <jwt_token>
X-User-Department: quality
```

---

## ⚙️ Implementation Priority

### **Phase 1 (CRITICAL):**
- [ ] GET /api/quality/pending-grns
- [ ] GET /api/quality/grn-details/{grnId}
- [ ] POST /api/quality/inspections/create

### **Phase 2 (HIGH):**
- [ ] GET /api/quality/inspection-templates
- [ ] GET /api/quality/templates/{templateId}/parameters
- [ ] POST /api/quality/inspections/{inspectionId}/submit

### **Phase 3 (MEDIUM):**
- [ ] GET /api/quality/inspections
- [ ] POST /api/quality/non-conformance

---

## 📝 Example Database Queries

### **Pending GRNs:**
```sql
SELECT * FROM grn_request 
WHERE status = 'awaiting_qc_inspection'
AND grn_type = 'normal'
ORDER BY grn_date DESC;
```

### **GRN Details with Items:**
```sql
SELECT g.*, gi.* 
FROM grn_request g
LEFT JOIN grn_request_items gi ON g.id = gi.grn_request_id
WHERE g.id = 140;
```

### **Active Templates:**
```sql
SELECT * FROM quality_inspection_templates
WHERE status = 'active'
AND type = 'incoming';
```

### **Template Parameters:**
```sql
SELECT * FROM quality_inspection_parameters
WHERE template_id = 1
ORDER BY sequence ASC;
```

---

## 🧪 Testing Endpoints with cURL

### **Test 1: Get Pending GRNs**
```bash
curl -X GET "http://localhost:3000/api/quality/pending-grns?type=incoming" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### **Test 2: Get GRN Details**
```bash
curl -X GET "http://localhost:3000/api/quality/grn-details/140" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### **Test 3: Create Inspection**
```bash
curl -X POST "http://localhost:3000/api/quality/inspections/create" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "grn_id": 140,
    "inspection_type": "incoming",
    "inspection_template_id": 1,
    "sampling_plan": "aql",
    "inspection_level": "normal",
    "sampling_qty": 20,
    "inspector_name": "John Doe",
    "status": "in_progress"
  }'
```

---

## ✅ Checklist for Backend Implementation

- [ ] Create `quality_inspection_templates` table
- [ ] Create `quality_inspection_parameters` table
- [ ] Create `quality_inspections` table
- [ ] Create `quality_non_conformance` table
- [ ] Implement all 8 API endpoints
- [ ] Add authentication middleware
- [ ] Add role-based authorization
- [ ] Implement error handling
- [ ] Add logging for audit trail
- [ ] Create database indexes for performance
- [ ] Test all endpoints with Postman/cURL
- [ ] Document API in Swagger/OpenAPI

---

**Last Updated:** 18-Dec-2025  
**Status:** Ready for Backend Implementation ✅
