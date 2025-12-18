# Quality & Accounts Module Implementation Roadmap

## 🎯 EXECUTIVE IMPLEMENTATION PLAN

---

## QUALITY CONTROL MODULE - FULL ROADMAP

### ✅ PHASE 1: Incoming Quality Control (IQC) - Weeks 1-2

#### Database Schema
```sql
-- 1. QC Templates
CREATE TABLE qc_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_code VARCHAR(50) UNIQUE,
    item_id INT,
    supplier_id INT,
    inspection_type ENUM('incoming', 'in_process', 'final'),
    aql_level DECIMAL(5,2),
    sample_size_type ENUM('normal', 'tightened', 'reduced'),
    sample_size INT,
    acceptance_number INT,
    rejection_number INT,
    inspection_criteria JSON,
    created_by INT,
    created_date DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (item_id) REFERENCES item(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 2. Inspection Execution
CREATE TABLE qc_inspections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inspection_no VARCHAR(50) UNIQUE,
    grn_id INT,
    work_order_id INT,
    qc_type ENUM('incoming', 'in_process', 'final'),
    template_id INT,
    inspector_id INT,
    batch_no VARCHAR(50),
    received_qty INT,
    sample_size INT,
    inspection_date DATETIME,
    status ENUM('pending', 'in_progress', 'completed', 'on_hold'),
    result ENUM('accept', 'accept_rework', 'reject'),
    remarks TEXT,
    created_date DATETIME,
    completed_date DATETIME,
    FOREIGN KEY (grn_id) REFERENCES grn_requests(id),
    FOREIGN KEY (work_order_id) REFERENCES work_order(id),
    FOREIGN KEY (template_id) REFERENCES qc_templates(id),
    FOREIGN KEY (inspector_id) REFERENCES employee_master(id)
);

-- 3. Individual Test Results
CREATE TABLE qc_test_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inspection_id INT,
    parameter_seq INT,
    parameter_name VARCHAR(200),
    parameter_type ENUM('dimension', 'color', 'weight', 'texture', 'other'),
    expected_min VARCHAR(50),
    expected_max VARCHAR(50),
    expected_value VARCHAR(100),
    actual_value VARCHAR(100),
    uom VARCHAR(20),
    test_status ENUM('pass', 'fail', 'na'),
    remarks TEXT,
    FOREIGN KEY (inspection_id) REFERENCES qc_inspections(id)
);

-- 4. Non-Conforming Report
CREATE TABLE ncr_management (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ncr_no VARCHAR(50) UNIQUE,
    inspection_id INT,
    item_id INT,
    defect_qty INT,
    accepted_qty INT,
    rejected_qty INT,
    rework_qty INT,
    scrap_qty INT,
    defect_description TEXT,
    severity ENUM('critical', 'major', 'minor'),
    defect_category VARCHAR(100),
    reported_by INT,
    reported_date DATETIME,
    status ENUM('open', 'investigation', 'root_cause_identified', 'capa_assigned', 'closed', 'verified'),
    root_cause TEXT,
    root_cause_analysis_date DATETIME,
    closed_date DATETIME,
    FOREIGN KEY (inspection_id) REFERENCES qc_inspections(id),
    FOREIGN KEY (item_id) REFERENCES item(id),
    FOREIGN KEY (reported_by) REFERENCES employee_master(id)
);

-- 5. CAPA (Corrective & Preventive Actions)
CREATE TABLE capa_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    capa_no VARCHAR(50) UNIQUE,
    ncr_id INT,
    action_type ENUM('corrective', 'preventive'),
    action_description TEXT,
    root_cause_link TEXT,
    action_owner_id INT,
    assigned_date DATETIME,
    due_date DATE,
    status ENUM('pending', 'in_progress', 'completed', 'verified', 'closed'),
    completion_date DATETIME,
    effectiveness_verification TEXT,
    verified_by INT,
    verified_date DATETIME,
    FOREIGN KEY (ncr_id) REFERENCES ncr_management(id),
    FOREIGN KEY (action_owner_id) REFERENCES employee_master(id),
    FOREIGN KEY (verified_by) REFERENCES employee_master(id)
);

-- 6. QC Sampling Plan
CREATE TABLE qc_sampling_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_code VARCHAR(50) UNIQUE,
    plan_name VARCHAR(100),
    lot_size_min INT,
    lot_size_max INT,
    sample_size INT,
    accept_number INT,
    reject_number INT,
    aql_level DECIMAL(5,2),
    is_active BOOLEAN
);
```

#### Frontend Components to Create
```
src/pages/Quality/
  ├─ QualityDashboard.jsx
  ├─ QCTemplates.jsx (manage templates)
  ├─ QCInspection.jsx (execute inspection)
  ├─ InspectionDetail.jsx (view results)
  ├─ NCRManagement.jsx (create NCR)
  ├─ CAPATracking.jsx (track corrective actions)
  └─ QualityReports.jsx
```

#### Key Features
1. **Create QC Templates**
   - Map items to templates
   - Define test parameters (dimensions, color, texture, etc.)
   - Set AQL sampling levels
   - Define acceptance/rejection criteria

2. **Execute QC Inspection**
   - Link to GRN automatically
   - Assign to QC officer
   - Record test results
   - Capture photos/attachments
   - Generate inspection report

3. **Decision Logic**
   - Accept (stock receipt immediately)
   - Accept with Rework (partial acceptance)
   - Reject (return to supplier)
   - Hold (pending additional testing)

4. **NCR Creation**
   - Auto-create from failed inspection
   - Assign severity level
   - Request root cause analysis
   - Trigger CAPA process

---

### ✅ PHASE 2: In-Process QC - Weeks 3-4

#### Key Features
1. **Production Line Checkpoints**
   - Assign QC checkpoints per operation
   - Automated sampling at intervals
   - Real-time quality metrics

2. **SPC Integration**
   - Control charts (X-bar, R-chart)
   - Trend analysis
   - Alert on out-of-control points

3. **Quality Hold Logic**
   - Auto-stop production if fail
   - Escalate to supervisor
   - Manual resumption approval

---

### ✅ PHASE 3: Final QC & Packaging - Weeks 5-6

#### Key Features
1. **Final Inspection Checklist**
2. **Packaging QC**
3. **Dispatch Clearance**
4. **Certificate of Analysis (CoA)**

---

## 💰 ACCOUNTS & FINANCE MODULE - FULL ROADMAP

### ✅ PHASE 1: Chart of Accounts & GL Setup - Weeks 1-2

#### Database Schema
```sql
-- 1. Chart of Accounts (Master)
CREATE TABLE chart_of_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_code VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'cost_of_goods_sold'),
    account_category VARCHAR(50),
    sub_category VARCHAR(50),
    opening_balance DECIMAL(18,2) DEFAULT 0,
    balance_as_on DATE,
    description TEXT,
    cost_center_applicable BOOLEAN DEFAULT FALSE,
    tax_applicable BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_date DATETIME
);

-- 2. Cost Centers
CREATE TABLE cost_centers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cost_center_code VARCHAR(20) UNIQUE,
    cost_center_name VARCHAR(100),
    department_id INT,
    location VARCHAR(50),
    responsible_person_id INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_date DATETIME
);

-- 3. General Ledger (Master Transaction Log)
CREATE TABLE general_ledger (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gl_entry_no VARCHAR(50) UNIQUE,
    account_id INT NOT NULL,
    cost_center_id INT,
    transaction_date DATE NOT NULL,
    posting_date DATE,
    document_type VARCHAR(50), -- 'PO', 'GRN', 'Invoice', 'Payment', 'Journal'
    document_number VARCHAR(50),
    document_date DATE,
    line_description TEXT,
    debit_amount DECIMAL(18,2) DEFAULT 0,
    credit_amount DECIMAL(18,2) DEFAULT 0,
    reference_type VARCHAR(50), -- 'invoice', 'payment', 'journal', etc.
    reference_id INT,
    reference_number VARCHAR(50),
    currency_code VARCHAR(3) DEFAULT 'INR',
    posted_by INT,
    posted_date DATETIME,
    is_posted BOOLEAN DEFAULT TRUE,
    narrative TEXT,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
    FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
    INDEX idx_date (transaction_date),
    INDEX idx_account (account_id)
);

-- 4. Accounts Payable (AP)
CREATE TABLE accounts_payable (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ap_number VARCHAR(50) UNIQUE,
    po_id INT,
    grn_id INT,
    invoice_id INT,
    vendor_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE,
    amount_in_words VARCHAR(500),
    total_amount DECIMAL(18,2),
    tax_amount DECIMAL(18,2) DEFAULT 0,
    amount_payable DECIMAL(18,2),
    paid_amount DECIMAL(18,2) DEFAULT 0,
    balance_amount DECIMAL(18,2),
    due_date DATE,
    payment_terms_days INT,
    discount_available DECIMAL(18,2) DEFAULT 0,
    early_payment_discount DECIMAL(18,2) DEFAULT 0,
    status ENUM('draft', 'submitted', 'three_way_matched', 'pending_approval', 'approved', 'pending_payment', 'partially_paid', 'paid', 'cancelled', 'disputed'),
    matched_with_grn BOOLEAN DEFAULT FALSE,
    invoice_received_date DATETIME,
    approval_date DATETIME,
    approved_by INT,
    notes TEXT,
    gl_posted BOOLEAN DEFAULT FALSE,
    created_date DATETIME,
    FOREIGN KEY (vendor_id) REFERENCES suppliers(id),
    FOREIGN KEY (po_id) REFERENCES purchase_order(id),
    FOREIGN KEY (grn_id) REFERENCES grn_requests(id),
    FOREIGN KEY (approved_by) REFERENCES employee_master(id),
    INDEX idx_vendor (vendor_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
);

-- 5. Accounts Receivable (AR)
CREATE TABLE accounts_receivable (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ar_number VARCHAR(50) UNIQUE,
    sales_invoice_id INT,
    customer_id INT NOT NULL,
    invoice_number VARCHAR(50),
    invoice_date DATE,
    invoice_amount DECIMAL(18,2),
    tax_amount DECIMAL(18,2) DEFAULT 0,
    total_amount DECIMAL(18,2),
    discount_offered DECIMAL(18,2) DEFAULT 0,
    amount_due DECIMAL(18,2),
    payment_received DECIMAL(18,2) DEFAULT 0,
    balance_due DECIMAL(18,2),
    due_date DATE,
    payment_terms_days INT,
    status ENUM('draft', 'submitted', 'open', 'partially_paid', 'paid', 'overdue', 'disputed', 'bad_debt', 'cancelled'),
    days_overdue INT DEFAULT 0,
    customer_name VARCHAR(100),
    credit_limit DECIMAL(18,2),
    customer_credit_rating VARCHAR(20),
    invoice_received_date DATETIME,
    notes TEXT,
    gl_posted BOOLEAN DEFAULT FALSE,
    created_date DATETIME,
    FOREIGN KEY (customer_id) REFERENCES selling_customer(id),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_days_overdue (days_overdue)
);

-- 6. Payment Records (Check Register)
CREATE TABLE payment_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    payment_id VARCHAR(50) UNIQUE,
    ap_id INT,
    payment_date DATE,
    payment_method ENUM('cheque', 'bank_transfer', 'cash', 'credit_card'),
    payment_amount DECIMAL(18,2),
    cheque_number VARCHAR(50),
    cheque_date DATE,
    bank_id INT,
    bank_account_id INT,
    bank_reference_number VARCHAR(100),
    payment_reference VARCHAR(100),
    clearing_status ENUM('pending', 'cleared', 'bounced', 'cancelled'),
    clearing_date DATE,
    remarks TEXT,
    created_by INT,
    created_date DATETIME,
    approved_by INT,
    approved_date DATETIME,
    FOREIGN KEY (ap_id) REFERENCES accounts_payable(id),
    FOREIGN KEY (created_by) REFERENCES employee_master(id),
    INDEX idx_status (clearing_status),
    INDEX idx_date (payment_date)
);

-- 7. Bank Reconciliation
CREATE TABLE bank_reconciliation (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reconciliation_date DATE,
    bank_account_id INT,
    bank_statement_balance DECIMAL(18,2),
    ledger_balance DECIMAL(18,2),
    outstanding_cheques DECIMAL(18,2),
    deposits_in_transit DECIMAL(18,2),
    other_adjustments DECIMAL(18,2),
    reconciled_balance DECIMAL(18,2),
    difference DECIMAL(18,2),
    status ENUM('pending', 'reconciled', 'variance_found'),
    reconciled_by INT,
    reconciled_date DATETIME,
    remarks TEXT,
    FOREIGN KEY (reconciled_by) REFERENCES employee_master(id)
);

-- 8. Budget Master
CREATE TABLE budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    budget_code VARCHAR(50) UNIQUE,
    budget_year INT,
    budget_period VARCHAR(20), -- 'annual', 'quarterly', 'monthly'
    cost_center_id INT,
    account_id INT,
    budgeted_amount DECIMAL(18,2),
    actual_amount DECIMAL(18,2) DEFAULT 0,
    committed_amount DECIMAL(18,2) DEFAULT 0,
    variance DECIMAL(18,2),
    variance_percentage DECIMAL(5,2),
    status ENUM('draft', 'approved', 'active', 'closed'),
    created_by INT,
    created_date DATETIME,
    approved_by INT,
    approved_date DATETIME,
    FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id)
);

-- 9. Financial Statements (Auto-generated)
CREATE TABLE financial_statements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    statement_type ENUM('balance_sheet', 'profit_loss', 'cash_flow', 'trial_balance'),
    statement_date DATE,
    statement_period VARCHAR(20),
    account_id INT,
    opening_balance DECIMAL(18,2),
    debit_amount DECIMAL(18,2) DEFAULT 0,
    credit_amount DECIMAL(18,2) DEFAULT 0,
    closing_balance DECIMAL(18,2),
    generated_date DATETIME,
    generated_by INT,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id)
);

-- 10. Expense Category Master
CREATE TABLE expense_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_code VARCHAR(20) UNIQUE,
    category_name VARCHAR(100),
    account_id INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id)
);
```

#### Implementation Tasks
1. **Design Chart of Accounts**
   - Aluminum manufacturing COA template
   - 100+ accounts typically needed

2. **Set up Cost Centers**
   - Production line 1, 2, 3
   - Extrusion, Finishing, Assembly departments
   - Sales, Marketing, Admin overhead

3. **Configure GL Settings**
   - Accounting period
   - Multi-currency support (if needed)
   - Tax calculation rules

---

### ✅ PHASE 2: Accounts Payable (AP) - Weeks 3-4

#### Workflow: Purchase Order → GRN → Invoice → Payment

**Step 1: Invoice Receipt**
```
PO (Buying) → GRN (Inventory) → Invoice (AP created)
```

**Step 2: 3-Way Matching**
```
Validate:
- PO qty ✓ GRN qty ✓ Invoice qty
- PO price ✓ Invoice price
- PO terms ✓ Invoice terms
```

**Step 3: GL Entry Auto-generation**
```
Dr. Inventory/Expense Account
  Cr. Accounts Payable
```

**Step 4: Payment Scheduling**
```
Due Date = Invoice Date + Payment Terms (e.g., +30 days Net 30)
```

**Step 5: Payment Execution**
```
Cheque/Bank Transfer → Payment Record Created → GL Posted
```

#### Frontend Features
1. Invoice dashboard (by vendor, by due date)
2. Payment approval workflow
3. Check register
4. Payment history per vendor

---

### ✅ PHASE 3: Accounts Receivable (AR) - Week 5

#### Workflow: Sales Invoice → Customer Payment → Reconciliation

**Step 1: Invoice Creation**
```
Sales Invoice (Selling) → AR record created automatically
```

**Step 2: Customer Tracking**
```
AR Dashboard:
- Open invoices by customer
- Total amount due
- Days overdue
- Credit limit usage
```

**Step 3: Payment Reception**
```
Customer Payment → Matched to Invoice → GL Posted
```

**Step 4: Aging Report**
```
Overdue Analysis:
- 0-30 days
- 31-60 days
- 61-90 days
- 90+ days
```

#### Frontend Features
1. Customer credit limit management
2. Collection status dashboard
3. Payment receipt logging
4. Dunning letter generation

---

### ✅ PHASE 4: Bank Reconciliation - Week 6

#### Process
```
Bank Statement (Monthly) → Bank Deposits/Cheques → Ledger Balance → Reconciliation
```

**Key Steps**:
1. Import bank statement
2. Match cleared payments
3. Identify outstanding cheques
4. Find deposits in transit
5. Reconcile difference
6. Generate reconciliation report

---

### ✅ PHASE 5: Financial Reporting - Week 7

#### Reports Generated
1. **Trial Balance** - All accounts with balances
2. **Balance Sheet** - Assets, Liabilities, Equity
3. **Profit & Loss (P&L)** - Revenue vs Expenses
4. **Cash Flow** - Cash in/out movements
5. **Vendor Aging** - Payables due
6. **Customer Aging** - Receivables due

---

## 🔌 INTEGRATION POINTS

### Buying Module → Accounts
```
PO (Buying) 
  → Amount Committed in GL
GRN (Inventory) 
  → Inventory value updated
Invoice (Finance) 
  → AP created, GL posted
Payment (Finance) 
  → Cash GL entry, AP cleared
```

### Selling Module → Accounts
```
Sales Invoice (Selling)
  → AR created, GL posted
Customer Payment (Finance)
  → AR cleared, Cash GL entry
Sales Return (Selling)
  → AR adjustment, GL reversal
```

### Production Module → Accounts
```
BOM (Production)
  → Raw material cost calculation
Work Order (Production)
  → Labor cost allocation
Production Entry (Production)
  → COGS calculation
```

---

## 📊 DASHBOARD WIREFRAMES

### Quality Dashboard
```
┌─────────────────────────────────────┐
│ QUALITY CONTROL DASHBOARD           │
├─────────────────────────────────────┤
│ ┌─────────┬─────────┬─────────────┐ │
│ │Inspections│ Defects │ CAPA Actions│ │
│ │ (month)   │ Trend   │ Pending    │ │
│ │    45     │  ↓ 15%  │     3      │ │
│ └─────────┴─────────┴─────────────┘ │
│                                     │
│ Recent NCRs                         │
│ ├─ NCR-001 | Critical | OPEN       │
│ ├─ NCR-002 | Major    | CAPA      │
│ └─ NCR-003 | Minor    | CLOSED    │
│                                     │
│ Acceptance Rate by Supplier        │
│ ├─ Supplier A: 98% ✓               │
│ ├─ Supplier B: 95% ✓               │
│ └─ Supplier C: 87% ⚠️               │
└─────────────────────────────────────┘
```

### Accounts Dashboard
```
┌──────────────────────────────────────┐
│ ACCOUNTS & FINANCE DASHBOARD         │
├──────────────────────────────────────┤
│ ┌──────────┬──────────┬─────────────┐│
│ │ AP Due   │ AR Due   │ Cash Balance││
│ │ ₹15L     │ ₹35L     │ ₹50L        ││
│ └──────────┴──────────┴─────────────┘│
│                                      │
│ P&L Summary (This Month)             │
│ Revenue:        ₹100L                │
│ COGS:           ₹(60L)               │
│ Gross Profit:   ₹40L                 │
│ Operating Exp:  ₹(15L)               │
│ Net Profit:     ₹25L                 │
│                                      │
│ Payables Aging                       │
│ ├─ Current (0-30):   ₹5L  ✓         │
│ ├─ 31-60 days:       ₹3L  ⚠️        │
│ └─ 60+ days:         ₹7L  🔴        │
└──────────────────────────────────────┘
```

---

## 📈 ROLLOUT TIMELINE

| Week | Quality | Accounts | Deliverable |
|------|---------|----------|-------------|
| W1 | ✅ DB Schema + Templates | ✅ COA Setup | DB + API Skeleton |
| W2 | ✅ Inspection Execution | ✅ GL Setup | Inspection Module Live |
| W3 | ✅ NCR Management | ✅ AP Workflows | NCR + AP Live |
| W4 | ✅ In-Process QC | ✅ AR Workflows | IPQC + AR Live |
| W5 | ✅ CAPA Tracking | ✅ Bank Recon | CAPA + Recon Live |
| W6 | ✅ Quality Reports | ✅ Payroll GL | Reports Ready |
| W7 | ✅ Testing | ✅ Fin Statements | Full Testing |
| W8 | ✅ Production Ready | ✅ Production Ready | ✅ Launch |

---

## 🎯 SUCCESS CRITERIA

### Quality Module
- ✅ 100% GRNs have QC inspection before stock receipt
- ✅ <1% defect escape (NCRs after stock receipt)
- ✅ 100% NCRs have root cause within 5 days
- ✅ 90% CAPA actions closed within due date

### Accounts Module
- ✅ 100% invoices matched to PO/GRN (3-way match)
- ✅ 0 payment discrepancies
- ✅ 100% bank reconciliation monthly
- ✅ 95% on-time payments (per terms)
- ✅ Financial statements generated within 10 days of month-end

---

## 💡 QUICK DECISIONS NEEDED

1. **Quality**: Will you implement AQL-based sampling or 100% inspection?
2. **Finance**: How many cost centers (estimate: 10-20)?
3. **Finance**: Multi-currency support needed (India only or export)?
4. **Finance**: Year-end close process - when is fiscal year-end?

