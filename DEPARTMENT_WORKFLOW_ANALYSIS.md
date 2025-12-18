# Aluminium ERP - Department-wise Workflow Analysis
**Generated**: Dec 18, 2025

---

## 📊 EXECUTIVE SUMMARY

Your ERP has **8 core departments** with varying levels of completeness:
- ✅ **Mature**: Buying, Inventory, Production, Selling
- 🟡 **Partial**: ToolRoom, HR/Payroll, Dispatch
- ❌ **Missing/Incomplete**: Quality Control, Accounts/Finance

**Total Controllers**: 30  
**Total Database Tables**: 150+  
**Total Frontend Pages**: 50+

---

## 1️⃣ BUYING DEPARTMENT ✅

### Current Workflow
```
Material Request → RFQ → Supplier Quotation → Purchase Order → GRN → Purchase Invoice
```

### Features Implemented
- ✅ Material Requests (create, list, approve)
- ✅ RFQs (create, send to suppliers)
- ✅ Supplier Quotations (track quotes from suppliers)
- ✅ Purchase Orders (create, edit, track)
- ✅ GRN Requests (goods receipt notes)
  - Two-step approval: Material Inspection + Storage Details
  - Automatic stock entry creation
  - Warehouse bin/rack assignment
  - QC status tracking (Pass/Fail/Hold)
  - Valuation rate for costing
- ✅ Purchase Invoices (track bills)
- ✅ Purchase Analytics

### Key Tables
- `material_request` & `material_request_item`
- `rfq`, `rfq_item`, `rfq_supplier`
- `supplier_quotation` & `supplier_quotation_item`
- `purchase_order` & `purchase_order_item`
- `grn_requests` & `grn_request_items` & `grn_request_logs`
- `purchase_invoice` & `purchase_invoice_item`
- `suppliers`, `supplier_group`, `supplier_quotation`

### APIs Available
```
GET  /api/material-requests
POST /api/material-requests
POST /api/rfqs
POST /api/quotations
GET  /api/purchase-orders
POST /api/purchase-orders
GET  /api/grn-requests
POST /api/grn-requests
```

### Status: PRODUCTION READY ✅

---

## 2️⃣ INVENTORY DEPARTMENT ✅

### Current Workflow
```
Stock Receipt → Warehouse Storage → Stock Balance → Transfers → Reorder Management
```

### Features Implemented
- ✅ Stock Entries (manual + GRN-based)
- ✅ Stock Balance (real-time tracking by warehouse)
- ✅ Warehouses (warehouse + bin/rack management)
- ✅ Stock Transfers (inter-warehouse transfers)
- ✅ Batch Tracking (track by batch/lot)
- ✅ Stock Reconciliation (physical vs system)
- ✅ Reorder Management (auto purchase requests)
- ✅ Stock Ledger (transaction history)
- ✅ Inventory Analytics

### Key Tables
- `stock` & `stock_entries` & `stock_entry_items`
- `stock_balance` & `stock_ledger`
- `warehouses` & `warehouse` (multiple structures)
- `batch_tracking`
- `material_transfers` & `material_transfer_items`
- `stock_reconciliation` & `stock_reconciliation_items`
- `reorder_management` & `reorder_items`

### Features
- Real-time inventory tracking
- FIFO/LIFO valuation support
- Multi-warehouse management
- Batch number tracking
- Low stock alerts
- Stock reconciliation reports
- Reorder point management

### Status: PRODUCTION READY ✅

---

## 3️⃣ PRODUCTION DEPARTMENT ✅

### Current Workflow
```
Production Plan → Work Orders → BOM → Job Cards → Production Entry → QC → Stock Receipt
```

### Features Implemented
- ✅ BOM (Bill of Materials)
  - Raw materials list
  - Operations list
  - Scrap materials
  - Dimension parameters
- ✅ Production Plans
- ✅ Work Orders (with operations)
- ✅ Operations & Sub-operations
- ✅ Workstations & Operations setup
- ✅ Production Entries (actual vs planned)
- ✅ Job Cards (operator assignment)
- ✅ Production Rejection tracking
- ✅ Production Analytics
- ✅ Machine Masters
- ✅ Die Registers & Rework logs

### Key Tables
- `bom`, `bom_line`, `bom_operation`, `bom_scrap`
- `production_plan` & `production_plan_item`
- `work_order`, `work_order_item`, `work_order_operation`
- `job_card`
- `operation` & `operation_sub_operation`
- `workstation`
- `production_entry` & `production_rejection`
- `machine_master`
- `die_register` & `die_rework_log`

### Status: PRODUCTION READY ✅

---

## 4️⃣ SELLING DEPARTMENT ✅

### Current Workflow
```
Quotation → Sales Order → Delivery Note → Sales Invoice → Payment
```

### Features Implemented
- ✅ Sales Quotations
- ✅ Sales Orders
- ✅ Delivery Notes (with delivery challan)
- ✅ Sales Invoices
- ✅ Customer Management
- ✅ Customer Complaints
- ✅ Delivery Tracking
- ✅ Dispatch Orders
- ✅ Selling Analytics
- ✅ Multi-item support with tax calculations

### Key Tables
- `selling_quotation` & items
- `selling_sales_order` & items
- `selling_delivery_note` & items
- `selling_invoice` & items
- `selling_customer`
- `customer_payment`
- `dispatch_order` & `dispatch_item`
- `delivery_challan`
- `shipment_tracking`
- `customer_complaint`

### Status: PRODUCTION READY ✅

---

## 5️⃣ TOOLROOM DEPARTMENT 🟡

### Current Workflow
```
Tool Masters → Die Registers → Maintenance Schedule → Rework Logs
```

### Features Implemented
- 🟡 Tool Master (basic CRUD)
- 🟡 Die Register (track dies)
- 🟡 Die Rework logs
- 🟡 Maintenance Schedule
- 🟡 ToolRoom Analytics

### Key Tables
- `tool_master`
- `die_register` & `die_rework_log`
- `maintenance_schedule` & `maintenance_history`

### Status: PARTIALLY COMPLETE 🟡
**Missing**:
- Preventive maintenance workflows
- Tool lifecycle tracking
- Tool history/audit trail
- Die performance metrics

---

## 6️⃣ HR & PAYROLL DEPARTMENT 🟡

### Current Workflow
```
Employee Masters → Attendance → Shift Allocation → Payroll → Payment
```

### Features Implemented
- 🟡 Employee Masters
- 🟡 Attendance Logs
- 🟡 Shift Allocation
- 🟡 Payroll Processing
- 🟡 Expense Masters (for employee expenses)

### Key Tables
- `employee_master`
- `attendance_log`
- `shift_allocation`
- `payroll`
- `expense_master`

### Status: BASIC SETUP ONLY 🟡
**Missing**:
- Leave management
- Performance review system
- Training records
- Promotion/salary increment workflows
- Attendance report analytics
- Payroll tax calculations

---

## 7️⃣ DISPATCH DEPARTMENT 🟡

### Current Workflow
```
Sales Invoice → Dispatch Order → Delivery → Shipment Tracking
```

### Features Implemented
- 🟡 Dispatch Orders
- 🟡 Dispatch Items tracking
- 🟡 Delivery Challan
- 🟡 Shipment Tracking
- 🟡 Delivery Notes

### Key Tables
- `dispatch_order` & `dispatch_item`
- `delivery_challan`
- `shipment_tracking`
- `selling_delivery_note`

### Status: PARTIALLY COMPLETE 🟡
**Missing**:
- Route optimization
- Driver management
- Real-time GPS tracking
- Delivery proof (photo/signature capture)
- SLA management

---

## 8️⃣ QUALITY CONTROL DEPARTMENT ❌

### Current Workflow (Proposed)
```
Incoming (GRN) → QC Inspection → Results → Acceptance/Rejection
Process QC → In-Transit QC → Final QC → Corrective Actions
```

### Features Partially Implemented
- ⚠️ QCController exists but minimal
- ⚠️ `inspection_checklist` & `inspection_result` tables exist
- ⚠️ GRN has QC status field (Pass/Fail/Hold)
- ❌ No full QC workflow UI

### What's Missing
- ❌ Inspection checklists management
- ❌ In-process quality control
- ❌ Final inspection workflows
- ❌ Non-conforming material (NCR) management
- ❌ CAPA (Corrective & Preventive Action) management
- ❌ Testing/measurement reports
- ❌ Quality metrics & KPIs dashboard
- ❌ Defect tracking & analysis

### Key Tables (Unused)
- `inspection_checklist` (schema exists, not used)
- `inspection_result` (schema exists, minimal use)
- `capa_action` (schema exists, not used)
- GRN `qc_status` field (recently added)

### Status: INCOMPLETE ❌
**Priority: HIGH** - Need comprehensive QC module

---

## 9️⃣ ACCOUNTS & FINANCE DEPARTMENT ❌

### Current Workflow (Proposed)
```
Purchase Invoice → Accounts Payable → Payments
Sales Invoice → Accounts Receivable → Collections → Financial Reports
```

### Features Partially Implemented
- ⚠️ `AccountsFinanceController.js` exists (14KB)
- ⚠️ `AccountsFinanceModel.js` exists (15KB)
- ⚠️ `account_ledger` table exists
- ⚠️ Invoice-based accounting (implicit)
- ❌ No complete accounts workflow UI

### What's Missing
- ❌ Chart of Accounts (COA) management
- ❌ General Ledger entries
- ❌ Accounts Payable (AP) workflow
- ❌ Accounts Receivable (AR) workflow
- ❌ Bank reconciliation
- ❌ Financial statements (P&L, Balance Sheet)
- ❌ Cost center allocation
- ❌ Budget tracking
- ❌ Tax compliance reports
- ❌ Expense tracking & approval workflows
- ❌ Asset management & depreciation

### Key Tables (Partially Used)
- `account_ledger` (exists)
- `vendor_payment` (exists, unused)
- `customer_payment` (exists, basic use)
- `costing_report` (exists, unused)
- `expense_master` (exists, basic use)

### Status: INCOMPLETE ❌
**Priority: HIGH** - Critical for financial management

---

## 🎯 QUALITY WORKFLOW - DETAILED RECOMMENDATIONS

### Phase 1: Incoming Quality Control (IQC)
```
GRN Received → QC Inspection → Accept/Reject → Stock Update
```

**Implementation Required**:
1. **Inspection Setup**
   - Create inspection templates per item/supplier
   - Define acceptance criteria (dimensions, weight, appearance, etc.)
   - Set sample sizes & acceptance levels (AQL)

2. **QC Execution**
   - Link to GRN automatically
   - QC officer inspects and records results
   - Compare against item specs
   - Generate inspection report

3. **Disposition**
   - Accept (full receipt)
   - Accept with rework (partial rejection)
   - Reject (return to supplier)
   - Hold for further testing

4. **Data Collection**
   - Measurement data
   - Test results
   - Photos/evidence
   - Inspector signature

### Phase 2: In-Process Quality Control (IPQC)
```
Production Started → IPQC Checkpoint → Adjust/Continue → Next Operation
```

**Implementation Required**:
1. Sampling plan per operation
2. Measurement against specifications
3. SPC (Statistical Process Control) charts
4. Real-time quality metrics

### Phase 3: Final Quality Control (FQC)
```
Production Complete → Final Inspection → Package → Dispatch
```

### Phase 4: Non-Conformance Management
```
Defect Found → NCR Created → Root Cause Analysis → CAPA → Verification
```

**Database Schema Needed**:
```sql
-- Quality Control Module Tables
CREATE TABLE qc_templates (
  id INT PRIMARY KEY,
  item_id INT,
  supplier_id INT,
  aql_level DECIMAL(5,2),
  sample_size INT,
  acceptance_criteria JSON,
  created_by INT,
  created_date DATETIME
);

CREATE TABLE qc_inspections (
  id INT PRIMARY KEY,
  grn_id INT,
  work_order_id INT,
  qc_type ENUM('incoming', 'in_process', 'final'),
  template_id INT,
  inspector_id INT,
  status ENUM('pending', 'in_progress', 'completed'),
  result ENUM('pass', 'fail', 'rework_required'),
  created_date DATETIME,
  completed_date DATETIME
);

CREATE TABLE qc_inspection_results (
  id INT PRIMARY KEY,
  inspection_id INT,
  parameter_name VARCHAR(200),
  expected_value VARCHAR(100),
  actual_value VARCHAR(100),
  uom VARCHAR(20),
  status ENUM('pass', 'fail'),
  remarks TEXT
);

CREATE TABLE ncr_management (
  id INT PRIMARY KEY,
  reference_no VARCHAR(50),
  item_id INT,
  defect_qty INT,
  defect_description TEXT,
  severity ENUM('critical', 'major', 'minor'),
  reported_by INT,
  reported_date DATETIME,
  status ENUM('open', 'investigation', 'closed'),
  root_cause TEXT,
  corrective_action TEXT
);

CREATE TABLE capa_actions (
  id INT PRIMARY KEY,
  ncr_id INT,
  action_type ENUM('corrective', 'preventive'),
  action_description TEXT,
  assigned_to INT,
  due_date DATE,
  status ENUM('pending', 'in_progress', 'completed', 'verified'),
  completion_date DATE,
  effectiveness_check TEXT
);
```

---

## 💰 ACCOUNTS & FINANCE WORKFLOW - DETAILED RECOMMENDATIONS

### Phase 1: Chart of Accounts & GL Setup
```
GL Setup → Cost Centers → Budget Templates → Tax Configuration
```

**Implementation Required**:
1. **Chart of Accounts (COA)**
   - Assets (Fixed, Current)
   - Liabilities (Current, Long-term)
   - Equity
   - Revenue
   - Expenses (Materials, Labor, Overhead)
   - Cost of Goods Sold (COGS)

2. **GL Master**
   - Account codes (e.g., 1000-Assets, 2000-Liabilities)
   - Account names & descriptions
   - Opening balances
   - Debit/Credit rules

3. **Cost Centers**
   - Production lines
   - Departments
   - Projects
   - Products

### Phase 2: Accounts Payable (AP)
```
PO → GRN → Invoice Matching (3-way) → Payment → Reconciliation
```

**Workflow**:
1. PO created (commitment)
2. GRN received (goods confirmation)
3. Invoice received (payment request)
4. 3-way match: PO ↔ GRN ↔ Invoice
5. Generate AP ledger entry
6. Schedule payment
7. Record payment
8. Update GL

### Phase 3: Accounts Receivable (AR)
```
Sales Invoice → Customer Statement → Payment → Reconciliation
```

**Workflow**:
1. Sales invoice created
2. AR ledger entry generated
3. Customer payment terms applied
4. Aging report generated
5. Payment received
6. Reconcile against invoice
7. Update GL

### Phase 4: Payroll Integration
```
Payroll → Salary GL Entries → Payment → GL Reconciliation
```

### Phase 5: Financial Reporting
```
GL Entries → Trial Balance → P&L → Balance Sheet → Tax Returns
```

**Database Schema Needed**:
```sql
-- Chart of Accounts
CREATE TABLE chart_of_accounts (
  id INT PRIMARY KEY,
  account_code VARCHAR(20) UNIQUE,
  account_name VARCHAR(100),
  account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense'),
  category VARCHAR(50),
  opening_balance DECIMAL(18,2),
  is_active BOOLEAN DEFAULT TRUE
);

-- General Ledger
CREATE TABLE general_ledger (
  id INT PRIMARY KEY,
  account_id INT,
  transaction_date DATE,
  voucher_type VARCHAR(20),
  voucher_no VARCHAR(50),
  debit DECIMAL(18,2) DEFAULT 0,
  credit DECIMAL(18,2) DEFAULT 0,
  reference_type VARCHAR(50),
  reference_id INT,
  description TEXT,
  posted_by INT,
  posted_date DATETIME,
  FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id)
);

-- Accounts Payable
CREATE TABLE accounts_payable (
  id INT PRIMARY KEY,
  po_id INT,
  grn_id INT,
  invoice_id INT,
  vendor_id INT,
  invoice_number VARCHAR(50),
  invoice_date DATE,
  amount DECIMAL(18,2),
  due_date DATE,
  status ENUM('draft', 'matched', 'pending_payment', 'paid', 'disputed'),
  payment_terms_days INT,
  created_date DATETIME,
  FOREIGN KEY (vendor_id) REFERENCES suppliers(id)
);

-- Accounts Receivable
CREATE TABLE accounts_receivable (
  id INT PRIMARY KEY,
  invoice_id INT,
  customer_id INT,
  invoice_amount DECIMAL(18,2),
  due_date DATE,
  payment_received DECIMAL(18,2) DEFAULT 0,
  balance_due DECIMAL(18,2),
  status ENUM('open', 'partially_paid', 'paid', 'overdue', 'disputed'),
  payment_terms_days INT,
  created_date DATETIME,
  FOREIGN KEY (customer_id) REFERENCES selling_customer(id)
);

-- Cost Centers
CREATE TABLE cost_centers (
  id INT PRIMARY KEY,
  code VARCHAR(20) UNIQUE,
  name VARCHAR(100),
  description TEXT,
  department_id INT,
  is_active BOOLEAN
);

-- Budget
CREATE TABLE budgets (
  id INT PRIMARY KEY,
  year INT,
  cost_center_id INT,
  account_id INT,
  budgeted_amount DECIMAL(18,2),
  actual_amount DECIMAL(18,2),
  variance DECIMAL(18,2),
  created_date DATETIME
);

-- Payments
CREATE TABLE payment_records (
  id INT PRIMARY KEY,
  ap_id INT,
  payment_date DATE,
  payment_method VARCHAR(50),
  amount DECIMAL(18,2),
  cheque_no VARCHAR(50),
  bank_id INT,
  payment_reference VARCHAR(100),
  status ENUM('pending', 'cleared', 'bounced'),
  created_by INT,
  created_date DATETIME
);

-- Bank Reconciliation
CREATE TABLE bank_reconciliation (
  id INT PRIMARY KEY,
  account_id INT,
  reconciliation_date DATE,
  bank_balance DECIMAL(18,2),
  ledger_balance DECIMAL(18,2),
  difference DECIMAL(18,2),
  reconciled_by INT,
  reconciled_date DATETIME
);
```

---

## 📈 IMPLEMENTATION PRIORITY MATRIX

| Rank | Department | Current Status | Priority | Impact | Effort | Est. Time |
|------|-----------|-----------------|----------|--------|--------|-----------|
| 1 | **Quality Control** | ❌ Incomplete | 🔴 CRITICAL | HIGH | MEDIUM | 3-4 weeks |
| 2 | **Accounts & Finance** | ❌ Incomplete | 🔴 CRITICAL | HIGH | HIGH | 4-6 weeks |
| 3 | ToolRoom | 🟡 Partial | 🟡 HIGH | MEDIUM | MEDIUM | 2-3 weeks |
| 4 | HR & Payroll | 🟡 Partial | 🟡 HIGH | MEDIUM | MEDIUM | 2-3 weeks |
| 5 | Dispatch | 🟡 Partial | 🟡 MEDIUM | MEDIUM | MEDIUM | 2 weeks |
| 6 | Buying | ✅ Complete | 🟢 LOW | STABLE | LOW | - |
| 7 | Inventory | ✅ Complete | 🟢 LOW | STABLE | LOW | - |
| 8 | Production | ✅ Complete | 🟢 LOW | STABLE | LOW | - |
| 9 | Selling | ✅ Complete | 🟢 LOW | STABLE | LOW | - |

---

## 🔄 COMPLETE PROCESS FLOW MAP

### Order-to-Cash (O2C)
```
Customer Inquiry
    ↓
Sales Quotation (Selling Module)
    ↓
Sales Order (Selling Module)
    ↓
Delivery Note (Selling Module)
    ↓
Delivery Tracking (Dispatch Module)
    ↓
Sales Invoice (Selling Module)
    ↓
Accounts Receivable (Finance Module) ❌ MISSING
    ↓
Payment Collection (Finance Module) ❌ MISSING
    ↓
Bank Reconciliation (Finance Module) ❌ MISSING
```

### Procure-to-Pay (P2P)
```
Purchase Requisition (Buying Module)
    ↓
RFQ (Buying Module)
    ↓
Supplier Quotation (Buying Module)
    ↓
Purchase Order (Buying Module)
    ↓
GRN (Buying Module)
    ↓
Quality Inspection (QC Module) ❌ MISSING
    ↓
Stock Receipt (Inventory Module)
    ↓
Purchase Invoice (Buying Module)
    ↓
Accounts Payable (Finance Module) ❌ MISSING
    ↓
Payment Processing (Finance Module) ❌ MISSING
    ↓
Bank Reconciliation (Finance Module) ❌ MISSING
```

### Make-to-Stock (MTS)
```
Sales Forecast
    ↓
Production Plan (Production Module)
    ↓
BOM & Work Orders (Production Module)
    ↓
Job Cards (Production Module)
    ↓
Production Execution (Production Module)
    ↓
In-Process QC (QC Module) ❌ MISSING
    ↓
Final QC (QC Module) ❌ MISSING
    ↓
Stock Receipt (Inventory Module)
    ↓
Stock Balance Update (Inventory Module)
```

---

## 🎬 QUICK START RECOMMENDATIONS

### Immediate Actions (Week 1)
1. ✅ Verify Buying module live
2. ✅ Verify Inventory module live
3. ✅ Verify Production module live
4. ✅ Verify Selling module live
5. 🔴 **Block calendar for Quality Control module** (START THIS WEEK)
6. 🔴 **Block calendar for Finance module** (START NEXT WEEK)

### Short-term (Month 1)
1. Develop Quality Control module
   - IQC (Incoming Quality Control)
   - Basic NCR management
   - Inspection templates

2. Begin Finance module foundation
   - Chart of Accounts setup
   - GL master setup
   - Cost center structure

### Medium-term (Month 2-3)
1. Complete Finance module
   - AP (Accounts Payable)
   - AR (Accounts Receivable)
   - Bank reconciliation
   - Financial reporting

2. Enhance Payroll integration

3. Complete ToolRoom features

---

## 📋 DEPARTMENT USERS & PERMISSIONS

```
👤 ADMIN
  ├─ All departments
  ├─ System settings
  └─ Audit logs

👤 BUYING MANAGER
  ├─ Material Requests (approve)
  ├─ RFQs (create, send)
  ├─ Purchase Orders (create, approve)
  └─ Supplier Quotations (view, compare)

👤 INVENTORY MANAGER
  ├─ GRN (approve, warehouse assign)
  ├─ Stock Balance (view)
  ├─ Stock Transfers (approve)
  ├─ Reconciliation (execute)
  └─ Reorder Management (configure, execute)

👤 PRODUCTION MANAGER
  ├─ Production Plans (create, approve)
  ├─ Work Orders (create, track)
  ├─ BOM (create, modify)
  ├─ Job Cards (assign, track)
  └─ Production Analytics (view)

👤 OPERATOR
  ├─ Job Card (view assigned)
  └─ Production Entry (record)

👤 QC OFFICER
  ├─ Inspection (execute)
  ├─ NCR (create, track)
  └─ CAPA (track)

👤 QUALITY MANAGER
  ├─ Inspection Templates (manage)
  ├─ NCR (approve, close)
  ├─ CAPA (assign, verify)
  └─ Quality Reports (view)

👤 ACCOUNTS MANAGER
  ├─ GL (view)
  ├─ AP (track, approve payment)
  ├─ AR (track, follow-up)
  └─ Financial Reports (generate)

👤 FINANCE MANAGER
  ├─ Chart of Accounts (manage)
  ├─ Budget (create, monitor)
  ├─ Bank Reconciliation (execute)
  └─ Financial Reporting (full access)

👤 SALES MANAGER
  ├─ Quotations (create, approve)
  ├─ Sales Orders (create, track)
  ├─ Delivery (track)
  └─ Customer Accounts (manage)

👤 TOOLROOM MANAGER
  ├─ Tool Masters (manage)
  ├─ Die Register (track)
  └─ Maintenance (schedule, track)

👤 HR MANAGER
  ├─ Employee Masters (manage)
  ├─ Attendance (approve)
  ├─ Payroll (process)
  └─ Shift Allocation (manage)

👤 DISPATCH MANAGER
  ├─ Dispatch Orders (create, assign)
  ├─ Shipment Tracking (track)
  └─ Delivery (confirm)
```

---

## 🚀 NEXT STEPS FOR USER

**Immediate**:
1. Review this analysis with stakeholders
2. Confirm Quality & Accounts workflows match your business
3. Prioritize between Quality first vs Finance first

**If Quality First** (Recommended):
- Set up QC inspection templates
- Map GRN to QC workflow
- Train QC team on new module

**If Finance First**:
- Set up Chart of Accounts
- Validate GL account structure
- Map invoices to GL entries

---

## 📞 QUESTIONS FOR CLARIFICATION

Before implementing Quality & Finance modules, please answer:

### Quality Control Questions
1. Do you need AQL-based sampling or 100% inspection?
2. Are there specific test parameters per item?
3. Do you need SPC (Statistical Process Control) charts?
4. Who are QC approvers - floor vs management?
5. How many warehouses/locations?

### Finance Questions
1. What's your Chart of Accounts structure (# of accounts)?
2. Do you track costs by cost center/department?
3. What financial statements are critical?
4. How often do you reconcile bank accounts?
5. Do you need multi-currency support?

---

**Document Version**: 1.0  
**Last Updated**: Dec 18, 2025  
**Status**: READY FOR IMPLEMENTATION
