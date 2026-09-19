# SPTech Aluminium Manufacturing ERP - Complete System Documentation

> **Document Status**: Production Reference  
> **Source of Truth**: Actual Codebase Implementation (`e:\codigix-project\Aluminium-erp`)  
> **Target Audience**: Management, Developers, QA Engineers, Operations, Plant Supervisors, Sales & Accounts  
> **Status Conventions**:  
> - 🟢 **Fully Implemented**: Database tables, backend controllers, service logic, routes, and frontend React UI fully active.  
> - 🟡 **Partially Implemented**: Core database models and backend endpoints exist; advanced reporting or automation pending.  
> - 🔵 **UI Only**: Visual interface present with mock data or pending backend service wiring.  
> - ⚪ **Scaffolded**: Future architectural placeholders reserved in schema or route configurations.

---

## Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Technology Stack & Repository Structure](#2-technology-stack--repository-structure)
3. [Authentication & Login Subsystem](#3-authentication--login-subsystem)
4. [Roles, Departments & RBAC Permission Matrix](#4-roles-departments--rbac-permission-matrix)
5. [Dashboards & Department Navigation](#5-dashboards--department-navigation)
6. [Company & Customer Master Management](#6-company--customer-master-management)
7. [Quotations, RFQs & Customer Purchase Orders](#7-quotations-rfqs--customer-purchase-orders)
8. [Customer Drawings & Design Engineering](#8-customer-drawings--design-engineering)
9. [Bill of Materials (BOM) & Multi-Level Assembly](#9-bill-of-materials-bom--multi-level-assembly)
10. [Routing Operations & Workstation Masters](#10-routing-operations--workstation-masters)
11. [Production Planning & Material Requirements (MRP)](#11-production-planning--material-requirements-mrp)
12. [Work Orders & Manufacturing Execution](#12-work-orders--manufacturing-execution)
13. [Job Cards & Shop Floor Tracking](#13-job-cards--shop-floor-tracking)
14. [Procurement, Sourcing & Vendor Management](#14-procurement-sourcing--vendor-management)
15. [Purchase Orders & PO Receipts](#15-purchase-orders--po-receipts)
16. [Goods Receipt Note (GRN) & Material Inward](#16-goods-receipt-note-grn--material-inward)
17. [Quality Control (QC) & Inspection Engine](#17-quality-control-qc--inspection-engine)
18. [Inventory, Warehousing & Stock Ledger](#18-inventory-warehousing--stock-ledger)
19. [Sub-Contracting & Challan Management](#19-sub-contracting--challan-management)
20. [Shipment, Dispatch & Logistics](#20-shipment-dispatch--logistics)
21. [Invoicing & Accounts Payable](#21-invoicing--accounts-payable)
22. [Customer Payments & Accounts Receivable](#22-customer-payments--accounts-receivable)
23. [Industrial Analytics, OEE & Machine Analysis](#23-industrial-analytics-oee--machine-analysis)
24. [Database Architecture & Entity Relationships](#24-database-architecture--entity-relationships)
25. [Department Document Status Workflow & State Machines](#25-department-document-status-workflow--state-machines)
26. [End-to-End Aluminium Manufacturing Business Workflow](#26-end-to-end-aluminium-manufacturing-business-workflow)
27. [Testing, Verification & Quick Start Guide](#27-testing-verification--quick-start-guide)

---

## 1. System Overview & Architecture

**SPTech Aluminium Manufacturing ERP** is an end-to-end industrial manufacturing resource planning platform designed specifically for aluminium extrusion, fabrication, CNC machining, surface finishing, and assembly operations.

The platform orchestrates the complete journey of custom aluminium components: from commercial customer inquiries, engineering drawings, and multi-tier Bill of Materials (BOM) to automated shop floor job routing, raw aluminium ingot/billet procurement, multi-stage Quality Control (QC), delivery challans, and customer payment reconciliation.

### High-Level Architectural Flow
```
                                  +---------------------------------------+
                                  |     React 19 Client (SPA / Vite)      |
                                  |   - TailwindCSS / Lucide Icons        |
                                  |   - DataTables / Recharts / Leaflet   |
                                  +-------------------+-------------------+
                                                      |
                                           REST API / JSON (Axios)
                                           Bearer JWT Auth Header
                                                      v
                                  +---------------------------------------+
                                  |       Express.js 5 API Gateway        |
                                  |   - JWT Authentication Middleware     |
                                  |   - Department Access Rules Config    |
                                  |   - Multer File Upload Engine         |
                                  |   - Puppeteer PDF Generation Engine   |
                                  +-------------------+-------------------+
                                                      |
                   +----------------------------------+----------------------------------+
                   |                                  |                                  |
                   v                                  v                                  v
        +---------------------+            +---------------------+            +---------------------+
        |  Commercial & Sales |            |  Design & Technical |            |  Manufacturing Core |
        | - Customer Masters  |            | - Drawing Masters   |            | - Production Plans  |
        | - Quotations & RFQs |            | - Multi-level BOMs  |            | - Work Orders       |
        | - Customer POs (PDF)|            | - Routing Sheets    |            | - Job Cards (Shop)  |
        | - Sales Orders      |            | - Workstation Config|            | - OEE & Machine Logs|
        +----------+----------+            +----------+----------+            +----------+----------+
                   |                                  |                                  |
                   +----------------------------------+----------------------------------+
                                                      |
                   +----------------------------------+----------------------------------+
                   |                                  |                                  |
                   v                                  v                                  v
        +---------------------+            +---------------------+            +---------------------+
        | Supply Chain / SCM  |            | Quality & Logistics |            | Finance & Accounts  |
        | - Vendor Management |            | - Incoming QC (GRN) |            | - Vendor Invoices   |
        | - Purchase Orders   |            | - In-Process QC     |            | - Payment Vouchers  |
        | - GRN & Warehousing |            | - Final QC Approval |            | - Customer Receipts |
        | - Stock Ledger      |            | - Delivery Challans |            | - Bank Accounts     |
        +----------+----------+            +----------+----------+            +----------+----------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |         MySQL Relational DB           |
                                  |  (Prisma ORM & Raw Query Engine)      |
                                  |  (100+ Tables, Constraints & Logs)    |
                                  +---------------------------------------+
```

---

## 2. Technology Stack & Repository Structure

### Backend Architecture
- **Server Runtime**: Node.js (v20+ / v24)
- **Framework**: Express.js (v5.2.x)
- **Database**: MySQL 8.x with Prisma ORM (v7.8.x) and high-throughput connection pooling via `mysql2`
- **Authentication**: Stateless JSON Web Tokens (`jsonwebtoken` v8.5), password security via `bcrypt` (salt rounds = 10)
- **File & Document Processing**: `multer` (100MB file limit for CAD/PDF drawings), `puppeteer` (headless PDF generation for Quotations, POs, and Challans), `exceljs` & `xlsx` (industrial spreadsheet exports)
- **Communications**: `nodemailer` (automated transactional email alerts), `imapflow` & `mailparser` (email-to-lead ingestion)

### Frontend Architecture
- **Library**: React 19 / TypeScript / Vite 7
- **Routing**: `react-router-dom` (v7.x)
- **Styling**: TailwindCSS (v3.4), Lucide React icon suite
- **Tables & Data Grids**: `datatables.net`, `datatables.net-react`
- **Visualizations**: `recharts` (OEE gauges, production output charts, scrap analytics)
- **Mapping & Logistics**: Leaflet & `react-leaflet` for real-time shipment dispatch tracking
- **Feedback & Forms**: SweetAlert2 (`sweetalert2`), Formik & Yup validation

### Directory Layout
```
Aluminium-erp/
|-- backend/
|   |-- prisma/
|   |   |-- schema.prisma             # Comprehensive database models (100+ tables)
|   |-- src/
|   |   |-- config/
|   |   |   |-- db.js                 # MySQL2 connection pool
|   |   |   |-- departmentAccessConfig.js # Inter-departmental document status flow & permissions
|   |   |   |-- uploadConfig.js       # File upload storage paths
|   |   |-- controllers/              # 50+ business logic controllers
|   |   |-- middleware/               # authenticate, authorize, errorHandler, upload
|   |   |-- routes/                   # 53 REST API route files
|   |   |-- services/                 # Quotation, PO, Challan, and PDF generation engines
|   |   |-- server.js                 # Express application bootstrapper
|   |-- seed.js                       # Database seeder with 8 departmental users
|-- frontend/
|   |-- src/
|   |   |-- components/               # UI components, layout sidebars, modals, status badges
|   |   |-- pages/                    # 80+ industrial domain views & pages
|   |   |-- App.jsx                   # Central routing & permission-gated navigation
|-- database/
|   |-- schema.sql                    # Pure SQL DDL definitions
|   |-- seed-data.sql                 # Roles, permissions, and department seed records
```

---

## 3. Authentication & Login Subsystem

### Authentication Flow
1. **Endpoint**: `POST /api/auth/login`
2. **Required Fields**: `email`, `password`
3. **Validation**:
   - Compares email against active users (`status = 'ACTIVE'`).
   - Verifies password using `bcrypt.compare()`.
4. **Token Generation**:
   - Generates a stateless JWT token with **24-hour expiration**.
   - **Payload Content**:
     ```json
     {
       "id": 1,
       "username": "sales_user",
       "email": "sales@company.com",
       "department_id": 1,
       "department_code": "SALES",
       "role_id": 2,
       "role": "SALES_MGR"
     }
     ```
5. **Session Handling**:
   - Token is returned in the response alongside user details and saved in `localStorage`.
   - Axios request interceptor attaches `Authorization: Bearer <token>` to all subsequent calls.
   - Unauthorized requests (`401`) trigger immediate redirection to the login view with a session expired notice.

### Pre-Configured Demo / Test Accounts (from `seed.js`):
| Email | Password | Department | Role Code | Primary Function |
| :--- | :--- | :--- | :--- | :--- |
| `admin@company.com` | `Admin@123` | **ADMIN** | `SYS_ADMIN` | Universal superuser access, configuration & audits |
| `sales@company.com` | `Sales@123` | **SALES** | `SALES_MGR` | Quotes, Customer POs, Sales Orders |
| `design@company.com` | `Design@123` | **DESIGN_ENG**| `DESIGN_ENG_ROLE` | Customer drawings, BOM creation & approvals |
| `procurement@company.com`| `Procurement@123`| **PROCUREMENT**| `PROC_OFFICER` | RFQs, Supplier POs, Vendor management |
| `production@company.com` | `Production@123` | **PRODUCTION** | `PROD_MGR` | Production planning, Work orders, Job cards |
| `quality@company.com` | `Quality@123` | **QUALITY** | `QA_INSP` | Incoming QC, In-process inspections, Rejections |
| `inventory@company.com` | `Inventory@123` | **INVENTORY** | `INV_MGR` | Stock ledger, Warehouses, Material issues |
| `shipment@company.com` | `Shipment@123` | **SHIPMENT** | `SHIP_OFFICER` | Delivery challans, Dispatch, Logistics tracking |
| `accounts@company.com` | `Accounts@123` | **ACCOUNTS** | `ACC_MGR` | Vendor bills, Customer payments, Payment receipts |

---

## 4. Roles, Departments & RBAC Permission Matrix

The ERP enforces security at two synchronized levels:
1. **Department Document Lifecycle Access** (`departmentAccessConfig.js`): Determines what document statuses a department can view, edit, or transition.
2. **Granular Role Permissions** (`role_permissions` + `permissions`): Checks specific actions like `PO_CREATE`, `BOM_MANAGE`, `QC_EDIT`.

### 9 Core Departments & Their Mandates:
1. **SALES (Code: 1)**: Commercial customer interactions, quotes, customer PO ingestion, order booking.
2. **DESIGN_ENG (Code: 2)**: Technical feasibility, engineering drawing registration, multi-tier BOM generation.
3. **PROCUREMENT (Code: 3)**: Supplier sourcing, purchasing raw materials (aluminium billets, extrusions, hardware).
4. **PRODUCTION (Code: 4)**: CNC machining, cutting, punching, powder coating, anodizing, job cards.
5. **QUALITY (Code: 5)**: Raw material inspection, in-line tolerance checks, final pre-dispatch verification.
6. **SHIPMENT (Code: 6)**: Packaging, delivery challans, logistics dispatch, truck tracking.
7. **ACCOUNTS (Code: 7)**: Billing, GST taxation, accounts payable, accounts receivable reconciliation.
8. **INVENTORY (Code: 8)**: Warehousing, stock ledger, bin locations, scrap tracking.
9. **ADMIN (Code: 9)**: Universal management, company master, system backups, cross-departmental overrides.

### Master Department Permission Matrix
| Module / Feature | SALES | DESIGN | PROC | PROD | QUAL | SHIP | ACC | INV | ADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Customer PO & Orders** | CRUD | View/Edit | View | View | View | View | View | View | Full |
| **Drawings & Master Items** | View | Full CRUD | - | View | View | - | - | - | Full |
| **BOM Creation & Approval** | View | Full CRUD | - | View | View | - | - | - | Full |
| **Production Planning** | View | - | - | Full CRUD | View | - | - | View | Full |
| **Work Orders & Job Cards** | - | - | - | Full CRUD | View | - | - | - | Full |
| **Vendors & Supplier POs** | - | - | Full CRUD | View | View | - | View | View | Full |
| **GRN & Material Inward** | - | - | View | View | View | - | View | Full CRUD| Full |
| **Quality Control & QC** | - | - | - | View | Full CRUD| - | - | - | Full |
| **Warehouses & Stock Ledger**| - | - | View | View | - | - | - | Full CRUD| Full |
| **Delivery Challans & Dispatch**| - | - | - | - | - | Full CRUD| View | View | Full |
| **Invoicing & Payments** | - | - | View | - | - | - | Full CRUD| - | Full |
| **OEE & Machine Analysis** | - | - | - | Full | - | - | - | - | Full |

---

## 5. Dashboards & Department Navigation

The user experience in SPTech Aluminium ERP is tailored through dedicated, role-specific operational dashboards:

### 1. Main & Admin Dashboard (`/dashboard`, `/admin-dashboard`)
- Plant-wide high-level metrics: total active orders, work orders in progress, dispatch volume, revenue this month.
- Cross-department bottlenecks: orders stuck in Design, pending procurement items, delayed job cards.

### 2. Sales Dashboard (`/sales-dashboard`)
- Pending customer quotations, conversion rates, incoming customer POs awaiting technical review.
- Active customer ledger overview and monthly order intake values.

### 3. Design Engineering Dashboard (`/design-dashboard`)
- Pending drawing approvals, new parts requiring 3D/2D CAD specs, unapproved BOMs holding up production.

### 4. Production Dashboard (`/production-dashboard`)
- Real-time shop floor status: Active Work Orders, Job Card execution rate, workstation load factor, daily scrap rate.

### 5. Procurement Dashboard (`/procurement-dashboard`)
- Open Purchase Requisitions, pending vendor POs, overdue vendor deliveries, raw material price variance.

### 6. Inventory & Warehouse Dashboard (`/inventory-dashboard`)
- Raw material stock levels (aluminium billets, profiles, sheets), minimum reorder alerts, stock valuation.

### 7. Quality Dashboard (`/quality-dashboard`)
- Incoming inspection clearance queue, in-process reject rates, vendor quality rating scorecards.

### 8. Shipment Dashboard (`/shipment-dashboard`)
- Ready-for-dispatch orders, pending Delivery Challans, vehicle dispatch schedule, transit tracking.

### 9. Accounts Dashboard (`/accounts-dashboard`)
- Overdue customer invoices, pending vendor payments, GST tax liability summary, cash flow projections.

---

## 6. Company & Customer Master Management

The commercial foundation of the ERP manages clients, vendor partners, and multi-location shipping/billing addresses:

### Key Entities & Capabilities:
- **Company Master (`companies`)**:
  - `company_name`, `company_code` (e.g., `CUST-0042`), `customer_type: REGULAR | OEM | PROJECT`.
  - Statutory identifiers: `gstin`, `cin`, `pan`.
  - Commercial terms: `payment_terms`, `credit_days`, `freight_terms`, `packing_forwarding`, `insurance_terms`.
- **Company Addresses (`company_addresses`)**:
  - Supports separate **Billing** and **Shipping** addresses with city, state, country, and pincode.
- **Client Contacts (`contacts`)**:
  - Directory of customer personnel categorized by role: `PRIMARY`, `PURCHASE`, `ACCOUNTS`, `TECHNICAL`.
- **Active Clients Portal**:
  - Real-time credit utilization monitoring, historical order count, and outstanding balance ledger.

---

## 7. Quotations, RFQs & Customer Purchase Orders

The commercial sales pipeline turns customer requests into legally binding production orders.

### 1. Quotation & RFQ Management
- **Quotation Ingestion**: Sales receives an RFQ and enters requirements into `quotation_requests`.
- **Costing & Pricing**: Detailed breakdown of raw aluminium weight, extrusion cost, anodizing/powder coating charges, packaging, and logistics.
- **Quotation PDF Generation**: Automatically renders and compiles branded quotations via Puppeteer with GST breakups and delivery clauses.

### 2. Customer Purchase Orders (Customer PO)
- **Ingestion & Document Capture**: Ingests customer PO with `po_number`, `po_date`, `currency`, and attachment of the original customer PO PDF (`pdf_path`).
- **Line Items & Subassemblies**:
  - `customer_po_items`: `item_code`, `description`, `hsn_code`, `drawing_no`, `revision_no`, `quantity`, `rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `delivery_date`.
  - Subassembly breakdown for modular aluminium assemblies (frames, handles, brackets).
- **Automated Sales Order Creation**: Approving a Customer PO automatically initializes a `sales_orders` master record and advances document status from `DRAFT (0)` to `DESIGN (1)`.


---

## 8. Customer Drawings & Design Engineering

In custom aluminium fabrication, precision engineering drawings are the definitive technical baseline.

### Drawing Lifecycle & Data Models:
- **Customer Drawings (`customer_drawings`)**:
  - `drawing_no`, `revision_no`, `part_name`, `customer_id`, `file_path` (PDF / DWG / DXF CAD upload), `uploaded_by`, `status: PENDING | APPROVED | REJECTED`.
- **Design Orders (`design_orders`)**:
  - Automatically created when a Sales Order is flagged with `drawing_required = 1`.
  - Design Engineers review part geometry, tolerances, aluminium alloy specifications (e.g., 6063-T6, 6082-T6), and surface treatment specs.
- **Design Rejections & Revisions**:
  - If customer drawing dimensions are unmachinable or conflict with die extrusion limits, engineers log a `design_rejection` with technical comments.
  - Sales coordinates drawing revisions with the client until formal sign-off.

---

## 9. Bill of Materials (BOM) & Multi-Level Assembly

The **BOM Engine** defines the hierarchical recipe of materials, subassemblies, and industrial processes needed to manufacture the finished product.

### Multi-Tier BOM Architecture:
```
  [Finished Goods BOM: Custom Architectural Aluminium Window Frame]
       │
       ├─── [Subassembly 1: Outer Extrusion Frame]
       │         ├── Raw Material: Aluminium Billet 6063 (Grade A)
       │         └── Process: Extrusion -> Cut-to-Length -> Mitre Saw Cutting
       │
       ├─── [Subassembly 2: Corner Joint Brackets]
       │         ├── Raw Material: Die-cast Aluminium Corner Cleats
       │         └── Hardware: M6 SS Screws & Rivets
       │
       └─── [Surface Treatment & Finish]
                 ├── Anodizing / Powder Coating (RAL 7016 Anthracite Grey, 60-80 microns)
                 └── EPDM Rubber Gasket & Weather Stripping
```

### Data Models & Workflow:
- **BOM Master (`bom`)**: Links to finished `item_id`, `bom_number`, `version`, `total_estimated_cost`, `status: DRAFT | SUBMITTED | APPROVED | REJECTED`.
- **BOM Line Items (`bom_items`)**:
  - Item classifications: `RAW_MATERIAL`, `SUB_ASSEMBLY`, `HARDWARE`, `CONSUMABLE`, `PACKING`.
  - Consumption quantities, scrap allowance percentage, and unit of measurement (Kg, Mtr, Nos).
- **Approval Workflow (`bom_approval_history`)**:
  - Design Engineer submits BOM -> Design Head / Production Manager reviews material feasibility and approves.
  - Upon approval, the Sales Order status advances to `PRODUCTION (2)`.

---

## 10. Routing Operations & Workstation Masters

Defines how materials move through physical plant machinery and human workstations.

### Core Routing Entities:
- **Workstations (`workstations`)**:
  - Industrial machine registry: CNC Double-Miter Saws, Punching Presses, CNC Machining Centers (4-axis / 5-axis), Anodizing Tanks, Powder Coating Booths, Assembly Benches.
  - Operational parameters: `machine_code`, `hourly_operating_rate`, `electricity_rating_kw`, `capacity_per_hour`.
- **Operations (`operations`)**:
  - Standard shop floor steps: `EXTRUSION`, `PRECISION_CUTTING`, `CORNER_CRIMPING`, `CNC_MILLING`, `DRILLING_TAPPING`, `ANODIZING`, `POWDER_COATING`, `FINAL_ASSEMBLY`, `PACKING`.
- **Routing Sheets (`operation_workstations` & `order_item_operations`)**:
  - Sequences operations in linear or parallel order with estimated setup time (`setup_time_mins`) and cycle time per unit (`cycle_time_mins`).

---

## 11. Production Planning & Material Requirements (MRP)

The **Production Planning Subsystem** converts confirmed sales orders into optimized shop floor manufacturing schedules while calculating raw material deficits.

### Material Requirements Planning (MRP) Logic:
1. **Gross Requirement Calculation**: System explodes the approved BOM across all ordered quantities:
   $$\text{Required Weight (Kg)} = \text{Finished Parts} \times \text{Unit Weight} \times (1 + \text{Scrap Factor})$$
2. **Net Stock Deficit**:
   $$\text{Purchase Deficit} = \text{Gross Required} - (\text{On-Hand Free Stock} + \text{Open In-Transit POs})$$
3. **Auto-Requisition**: If raw aluminium profiles or hardware fall short, automated **Material Requisitions (MR)** are dispatched to Procurement.
4. **Production Plan Master (`production_plans`)**:
   - Batches orders by aluminium alloy, profile section, or delivery priority.
   - Allocates dates, target workstation hours, and production output targets.

---

## 12. Work Orders & Manufacturing Execution

The **Work Order** is the formal manufacturing authorization released to the factory floor.

### Work Order Data Schema & Progression:
- **Model (`work_orders`)**:
  - `work_order_no` (e.g., `WO-2026-0819`), `sales_order_id`, `production_plan_id`, `item_id`, `target_quantity`, `completed_quantity`, `scrapped_quantity`, `start_date`, `due_date`.
- **Status Lifecycle**:
  ```
  [PLANNED] ──► [RELEASED] ──► [IN_PROGRESS] ──► [QC_INSPECTION] ──► [COMPLETED]
  ```
- **Material Consumption Tracking (`work_order_material_consumption`)**:
  - Logs actual aluminium kilograms and hardware consumed versus standard BOM allowances, highlighting material yield efficiency.

---

## 13. Job Cards & Shop Floor Tracking

For every discrete operation in a Work Order, a physical or digital **Job Card** is dispatched to machine operators.

### Shop Floor Execution Flow:
1. **Card Issuance (`job_cards`)**:
   - Contains `job_card_no`, `work_order_id`, `operation_id`, `workstation_id`, `assigned_operator`, `target_qty`.
2. **Time & Machine Logging (`job_card_time_logs`)**:
   - Machine operator clocks in at the workstation terminal: `start_time`, `end_time`, `duration_minutes`.
3. **Downtime Auditing (`job_card_downtime_logs`)**:
   - Unscheduled stoppages are categorized: `TOOL_BREAKAGE`, `POWER_FAILURE`, `RAW_MATERIAL_DEFICIT`, `MACHINE_SETUP`.
4. **Quality & Yield Tracking (`job_card_quality_logs`)**:
   - Tracks `accepted_qty`, `reworked_qty`, and `rejected_qty` along with root-cause defect classification (scratches, dimensional variation, anodizing blisters).

---

## 14. Procurement, Sourcing & Vendor Management

Manages supplier relations, material pricing, and vendor performance for raw aluminium ingots, extrusion profiles, tooling, and finishes.

### Key Procurement Capabilities:
- **Vendor Directory (`vendors`)**:
  - Comprehensive supplier profiles: GSTIN, PAN, Bank Details, Approved Material Categories, Payment Terms.
- **Procurement RFQs (`procurement_rfqs` & `procurement_rfq_items`)**:
  - Generates RFQs for bulk aluminium billet/coil purchasing.
- **Vendor Assignments (`procurement_rfq_vendor_assignments`)**:
  - Sends tenders to multiple vendors and facilitates side-by-side commercial quote comparison.
- **Vendor Ledger & Performance Scoring**:
  - Tracks on-time delivery rate, quality rejection percentages, and accounts payable balances.


---

## 15. Purchase Orders & PO Receipts

The purchasing lifecycle turns material requisitions into legally binding vendor commitments.

### Purchase Order Workflow:
1. **PO Creation (`purchase_orders` & `purchase_order_items`)**:
   - Authorized by Procurement Officer or Admin.
   - Contains `po_number`, `vendor_id`, delivery timeline, payment terms, and freight clauses.
   - Line items define aluminium alloy grade, profile die numbers, cross-sectional dimensions, quantity in Kg/Mtr, unit price, and GST breakdown.
2. **Automated PDF Generation**:
   - Puppeteer renders an industrial PO with vendor details, terms, authorized signature space, and barcoded PO numbers.
3. **PO Receipts (`po_receipts` & `po_receipt_items`)**:
   - Captures partial vendor deliveries, tracking received vs. pending balance quantities.

---

## 16. Goods Receipt Note (GRN) & Material Inward

Controls the physical receiving dock, weighbridge checks, and warehouse stock receipt.

### GRN Physical & System Inward Flow:
```
  [Truck Inward at Gate] ──► [Weighbridge Gross Weight Capture]
                                         │
                                         ▼
                            [Material Unloading & Visual Check]
                                         │
                                         ▼
                            [GRN Entry Generated in ERP]
                                         │
                                         ▼
                         [Quality Inspection Queue (QC)]
                                ├── (Passed) ──► [Stock Ledger Credit]
                                └── (Rejected) ─► [Quarantine / Debit Note]
```

### Key GRN Features:
- **Models (`grns`, `grn_items`)**: Ingests vendor delivery challan number, vehicle number, gross/tare/net weight.
- **Excess Delivery Approval (`grn_excess_approvals`)**:
  - In aluminium extrusion supply, standard industry delivery tolerance is typically $\pm 5\% - 10\%$.
  - If received weight exceeds the PO line item beyond allowed tolerance, the system blocks inwarding until Procurement Manager grants an Excess Approval.

---

## 17. Quality Control (QC) & Inspection Engine

Aluminium fabrication requires strict metallurgical and dimensional quality compliance.

### 3-Stage Quality Architecture:
1. **Incoming QC (Raw Material Verification)**:
   - Evaluates incoming billets/extrusions for surface defects, dimension tolerance (vernier/micrometer), chemical composition test reports (MTC), and hardness (Webster / Barcol hardness).
2. **In-Process QC (Shop Floor Inspections)**:
   - Inspects intermediate operations (e.g., angle of 45-degree miter cuts, CNC hole tapping pitch, anodizing film thickness in microns).
3. **Final QC (Pre-Dispatch Clearance)**:
   - Full functional check of assembled units, packaging integrity, and scratch-free surface inspection.
- **Data Models (`qc_inspections`, `qc_inspection_items`, `qc_attachments`)**:
  - Stores parameter-by-parameter measured values, tolerance boundaries, high-resolution photographic proof of defects, and final disposition: `ACCEPTED`, `REJECTED`, or `REWORK`.

---

## 18. Inventory, Warehousing & Stock Ledger

The **Inventory Engine** maintains real-time stock balances across multiple plant warehouses, racks, and bin locations.

### Key Data Structures & Mechanics:
- **Warehouses (`warehouses`)**:
  - Segregated storage locations: `RAW_MATERIAL_STORE`, `DIE_TOOL_ROOM`, `WORK_IN_PROGRESS_WIP`, `FINISHED_GOODS`, `SCRAP_YARD`, `QUARANTINE`.
- **Double-Entry Stock Ledger (`stock_ledger`)**:
  - Every single movement (GRN inward, Work Order issue, finished goods production, dispatch) generates an immutable debit/credit transaction with timestamp, reference document, and resulting balance.
- **Real-Time Stock Balance (`stock_balance`)**:
  - Instant snapshot of physical quantity, allocated quantity, free stock, and monetary valuation.
- **Aluminium Scrap & Melt Loss Tracking**:
  - Tracks extrusion cut-ends, swarf, and CNC offcuts. Scrap is weighed and categorized (e.g., clean 6063 scrap vs. mixed alloy scrap) for remelting or secondary foundry sale.

---

## 19. Sub-Contracting & Challan Management

For specialized operations not handled in-house (such as specialized chemical chromating, PVDF coating, or oversized thermal break crimping), work is subcontracted.

### Sub-Contract Workflow:
1. **Outward Challan (`outward_challans` & `outward_challan_items`)**:
   - Statutory delivery challan generated to accompany raw aluminium parts dispatched to the job-worker under GST job work rules.
2. **External Processing**:
   - Vendor executes the requested surface coating or anodizing process.
3. **Inward Challan (`inward_challans` & `inward_challan_items`)**:
   - Reconciles returned finished parts against the original outward batch, accounting for standard process weight loss.

---

## 20. Shipment, Dispatch & Logistics

The **Shipment Module** governs order packaging, transit documentation, and final delivery to client construction sites or factory plants.

### Dispatch Execution Flow:
1. **Shipment Planning (`shipment_orders`)**:
   - Aggregates completed, QC-cleared items from multiple Work Orders.
   - Calculates total dispatch weight (Kg) and volume (CBM) to allocate transport vehicles.
2. **Delivery Challan Generation (`delivery_challans` & `delivery_challan_items`)**:
   - Formal multi-copy shipping document detailing items, HSN codes, serial tags, driver details, and vehicle registration numbers.
3. **Real-Time Logistics Tracking (`shipment_tracking_logs`)**:
   - Leaflet/Google Maps integration renders truck routes, waypoint checkpoints, and real-time transit status (`DISPATCHED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`).
4. **Status Handshake**:
   - Generating a Delivery Challan automatically transitions the parent Sales Order from `DISPATCH_PENDING (3)` to `PAYMENT_PENDING (4)`.

---

## 21. Invoicing & Accounts Payable

Maintains financial integrity between procurement, raw material receipts, and supplier payouts.

### 3-Way Invoice Matching:
Before a vendor invoice is approved for payment, the system reconciles three data streams:
$$\text{Purchase Order (PO)} \iff \text{Goods Receipt Note (GRN)} \iff \text{Vendor Commercial Invoice}$$
- **Vendor Invoices (`vendor_invoices`)**: Logs invoice number, tax date, taxable value, GST breakup, and credit due date.
- **Payment Processing & Vouchers (`payments`, `payment_vouchers`)**:
  - Accounts Manager approves payouts via Bank Transfer (NEFT/RTGS), Cheque, or Letter of Credit (LC).
  - Updates the `vendor_ledger` with real-time outstanding balances.


---

## 22. Customer Payments & Accounts Receivable

Manages the incoming revenue pipeline, credit limits, and final order financial settlement.

### Financial Mechanics & Models:
- **Customer Payments (`customer_payments` & `payment_receipts`)**:
  - Ingests customer remittance details: Cheque No, UTR / Bank Reference, Payment Date, Amount, TDS Withholding.
  - Allocates payments against specific Sales Orders and Delivery Challans.
- **Customer Ledger (`customer_ledger`)**:
  - Maintains running debit/credit ledger balances for every client company.
- **Bank Accounts Management (`bank_accounts`)**:
  - Tracks multiple enterprise bank accounts, managing deposits, transfers, and bank reconciliation.
- **Order Closure**:
  - Once full payment is matched against the order total, Accounts Manager marks the order as `CLOSED (5)`.

---

## 23. Industrial Analytics, OEE & Machine Analysis

The ERP includes advanced shop floor intelligence to evaluate plant productivity and equipment reliability.

### Overall Equipment Effectiveness (OEE) Engine
The system calculates real-time OEE for every CNC and extrusion workstation using machine logs:
$$\text{OEE} = \text{Availability (A)} \times \text{Performance (P)} \times \text{Quality (Q)}$$
- **Availability**: $\frac{\text{Operating Time}}{\text{Planned Production Time}}$ (factoring in setup times and downtime logs).
- **Performance**: $\frac{\text{Actual Output}}{\text{Theoretical Maximum Output}}$ based on workstation cycle ratings.
- **Quality**: $\frac{\text{Accepted Parts}}{\text{Total Parts Produced}}$ based on Job Card quality logs.

### Key Analytical Dashboards:
- **Machine Analysis (`machineAnalysisController.js`)**: Mean Time Between Failures (MTBF), Mean Time to Repair (MTTR), power consumption metrics.
- **Project Analysis & Material Consumption (`projectAnalysisController.js`)**: Compares theoretical estimated cost vs. actual incurred manufacturing cost.
- **Scrap & Waste Intelligence**: Analyzes cut-loss percentages per aluminium profile type to optimize cutting nesting algorithms.

---

## 24. Database Architecture & Entity Relationships

The ERP database is an industrial-strength MySQL relational schema (managed via Prisma ORM and raw SQL scripts) with **over 100 relational tables**.

### Master Entity-Relationship Hierarchy:
```
   [companies] 1 ──────────* [customer_pos] 1 ──────────* [sales_orders]
        │                           │                                │
        ├──────* [contacts]         └──────* [customer_po_items]     ├──────* [design_orders]
        └──────* [company_addresses]                                 │              │
                                                                     │              ▼
   [vendors] 1 ────────────* [purchase_orders]                       │      [customer_drawings]
        │                           │                                │              │
        └──────* [vendor_invoices]  └──────* [grns]                  │              ▼
                                                │                    │            [bom]
                                                ▼                    │              │
                                         [qc_inspections]            ├──────────────┘
                                                │                    ▼
                                                ▼             [production_plans]
                                         [stock_ledger]              │
                                                ▲                    ▼
                                                │             [work_orders] 1 ────* [job_cards]
                                                │                    │                   │
                                                └────────────────────┴───────────────────┘
                                                                     │ (Finished Goods)
                                                                     ▼
                                                              [shipment_orders]
                                                                     │
                                                                     ▼
                                                             [delivery_challans]
                                                                     │
                                                                     ▼
                                                             [customer_payments]
```

### Data Integrity Standards:
- **Cascade Deletions**: Line items (e.g., `customer_po_items`, `bom_items`, `grn_items`) automatically cascade on parent deletion.
- **Document Access Auditing (`document_access_logs`)**: Every status change and document revision records `user_id`, `document_type`, `previous_status`, `new_status`, `timestamp`, and client IP address.

---

## 25. Department Document Status Workflow & State Machines

The hallmark of the SPTech Aluminium ERP is its **rigorous, inter-departmental state machine** defined in `backend/src/config/departmentAccessConfig.js`. No single department can bypass or advance an order without the preceding department's sign-off.

### The 6-Stage Document Status Flow:
```
  State 0: [DRAFT]
    │      - Owner: SALES
    │      - Actions: Ingest Customer PO, build quotation, configure initial order.
    ▼      - Advance To: State 1 (DESIGN)
  State 1: [DESIGN]
    │      - Owner: DESIGN_ENG
    │      - Actions: Review CAD drawings, create multi-level BOM, verify tooling.
    ▼      - Advance To: State 2 (PRODUCTION)
  State 2: [PRODUCTION]
    │      - Owner: PRODUCTION & QUALITY
    │      - Actions: Release Production Plan, issue Work Orders, execute Job Cards, run QC.
    ▼      - Advance To: State 3 (DISPATCH_PENDING)
  State 3: [DISPATCH_PENDING]
    │      - Owner: QUALITY & SHIPMENT
    │      - Actions: Pre-dispatch inspection clearance, vehicle packing, load allocation.
    ▼      - Advance To: State 4 (PAYMENT_PENDING)
  State 4: [PAYMENT_PENDING]
    │      - Owner: SHIPMENT & ACCOUNTS
    │      - Actions: Generate Delivery Challan, track transit, deliver goods, raise invoice.
    ▼      - Advance To: State 5 (CLOSED)
  State 5: [CLOSED]
           - Owner: ACCOUNTS & ADMIN
           - Actions: Customer payment reconciliation, tax filing, archive order.
```

---

## 26. End-to-End Aluminium Manufacturing Business Workflow

To understand how the entire ERP operates in practice, consider this complete scenario:

### Phase 1: Ingestion & Commercial Sales
1. **Customer Ingestion**: Sales registers *Skyline Builders Ltd* in Company Master with GSTIN and shipping address.
2. **Customer PO**: Client sends a purchase order for 500 units of *Architectural Curtain Wall Sub-Frames (Drawing #DWG-AL-904)*. Sales logs the PO and attaches the client's PDF.
3. **Sales Order Creation**: Sales generates Sales Order `SO-2026-104`, marks `drawing_required = 1`, and moves status to **DESIGN (1)**.

### Phase 2: Engineering & BOM Formulation
4. **Design Review**: Design Engineering downloads the CAD drawing, uploads it to Drawing Master, checks alloy specifications (6063-T6), and sets tolerances.
5. **BOM Creation**: Engineer creates `BOM-904` detailing 4.2 kg aluminium profile, 8 corner bracket cleats, EPDM gaskets, and 16 stainless steel screws per unit.
6. **BOM Approval**: Design Head approves the BOM. Order advances to **PRODUCTION (2)**.

### Phase 3: Material Planning & Sourcing
7. **MRP Calculation**: The system explodes BOM for 500 units: 2,100 kg aluminium profile required. On-hand inventory in `RAW_MATERIAL_STORE` is only 600 kg.
8. **Purchase Order**: Procurement generates PO `PO-AL-5501` to *Hindalco Industries* for 1,500 kg raw extrusion billets.
9. **GRN & Incoming QC**: Delivery arrives. Weighbridge logs gross weight. Inward team generates GRN `GRN-882`. Quality inspector tests hardness and checks dimensional tolerances, marking the batch `ACCEPTED`. Stock ledger credits 1,500 kg.

### Phase 4: Shop Floor Manufacturing
10. **Production Scheduling**: Production Manager batches the 500 units into Production Plan `PP-301` and issues Work Order `WO-7701`.
11. **Job Card Execution**:
    - **Station 1 (CNC Saw)**: Operator cuts profiles to 45-degree angles. Logs 120 mins runtime, 0 scrap.
    - **Station 2 (Punching & Milling)**: Slots punched for drainage and corner joints.
    - **Station 3 (Powder Coating)**: Dispatched on an outward challan for RAL 7016 Anthracite Grey coating. Inward challan confirms return.
    - **Station 4 (Final Assembly)**: Brackets crimped and rubber gaskets fitted.
12. **In-Process QC**: Inspector tests 10% random sample for coating thickness and corner rigidity. Work Order is marked complete and moves order to **DISPATCH_PENDING (3)**.

### Phase 5: Packaging, Dispatch & Invoicing
13. **Shipment Planning**: Shipment team groups the 500 units (total weight: 2,350 kg) into vehicle schedule `SHP-2026-44`.
14. **Delivery Challan**: Official Delivery Challan `DC-9011` is generated. Driver picks up physical copy. Order transitions to **PAYMENT_PENDING (4)**.
15. **Transit Tracking**: Dispatch updates live waypoint status as the truck moves to the client site. Goods are safely delivered and signed off.

### Phase 6: Financial Reconciliation
16. **Commercial Invoicing**: Accounts generates the GST Tax Invoice totaling $45,000 + 18% GST.
17. **Payment Receipt**: Client wires funds via NEFT. Accounts logs Customer Payment `CP-331`, allocates against `SO-2026-104`, and reconciles the customer ledger.
18. **Order Closure**: System transitions order status to **CLOSED (5)**.

---

## 27. Testing, Verification & Quick Start Guide

### 1. Launching the System Locally

#### Backend API Service:
```bash
cd e:\codigix-project\Aluminium-erp\backend
npm install
node seed.js                # Seeds 8 departmental users and master permissions
npm run dev                 # Starts Express server on http://localhost:5000 (or configured PORT)
```

#### Frontend Client Application:
```bash
cd e:\codigix-project\Aluminium-erp\frontend
npm install
npm run dev                 # Starts Vite dev server on http://localhost:5173
```

### 2. Multi-Role Testing Protocol
Open `http://localhost:5173` and verify each department's boundary using the seed accounts:
1. **Sales Department Test**:
   - Login: `sales@company.com` / `Sales@123`
   - Verify access to Customer PO, Sales Orders, Quotations.
   - Create a sample Sales Order and verify status transitions to `DESIGN (1)`.
2. **Design Department Test**:
   - Login: `design@company.com` / `Design@123`
   - Verify Customer Drawings and BOM Creation screens are accessible.
   - Approve a sample BOM and verify status advances to `PRODUCTION (2)`.
3. **Production Department Test**:
   - Login: `production@company.com` / `Production@123`
   - Verify Work Order generation, Job Card time logging, and Operation Masters.
4. **Quality Department Test**:
   - Login: `quality@company.com` / `Quality@123`
   - Inspect incoming GRN items and log an inspection result.
5. **Shipment Department Test**:
   - Login: `shipment@company.com` / `Shipment@123`
   - Generate a Delivery Challan and verify status advances to `PAYMENT_PENDING (4)`.
6. **Accounts Department Test**:
   - Login: `accounts@company.com` / `Accounts@123`
   - Ingest a customer payment and verify order transitions to `CLOSED (5)`.
7. **Admin Superuser Test**:
   - Login: `admin@company.com` / `Admin@123`
   - Verify unrestricted cross-department navigation, User Management, and Backup tools.

---
*SPTech Aluminium Manufacturing ERP Documentation verified directly against the production codebase.*
