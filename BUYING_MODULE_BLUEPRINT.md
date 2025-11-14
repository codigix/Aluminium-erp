# 🛍️ Buying Module - Complete Blueprint

## Status: Building End-to-End Implementation

### ✅ Already Implemented
1. ✅ Supplier Management (Master, Groups, Contacts, Addresses)
2. ✅ Item Master (with pricing, HSN, GST)
3. ✅ Purchase Orders (Create, Edit, Status workflow)
4. ✅ Purchase Receipts/GRN (Quality checks, Stock updates)
5. ✅ Purchase Invoices (Tax calculation, Payment tracking)
6. ✅ Basic Analytics

### 🔧 Missing & In Progress

#### 1. Material Request Module
- **Purpose**: Allow departments to request materials
- **Status Workflow**: Draft → Approved → Ordered → Received
- **Fields**: Item, Quantity, Required Date, Purpose, Department, Requested By
- **Features**: 
  - Create MR
  - Approve/Reject
  - Link to PO
  - Status tracking
  - Department filtering

#### 2. Request for Quotation (RFQ)
- **Purpose**: Create RFQs from approved Material Requests
- **Features**:
  - Create RFQ
  - Select suppliers
  - Set validity period
  - Track supplier responses
  - Compare quotations
  - Auto-convert to PO

#### 3. Supplier Quotation
- **Purpose**: Record supplier responses to RFQ
- **Features**:
  - Record rate & lead time
  - Track quotation status
  - Compare with other quotes
  - Accept/Reject
  - Auto-convert to PO

#### 4. Enhanced Supplier Management
- Supplier Scorecard calculations
- Performance metrics
- Rating system
- Contact & Address management

#### 5. Buying Analytics & Reports
- Purchase Analytics (by supplier, category)
- PO Analysis (ordered vs received vs billed)
- Supplier-wise reports
- Procurement Tracker
- Items to Order report

### Database Tables Status
```
✅ supplier - Complete
✅ supplier_group - Complete
✅ contact - Complete  
✅ address - Complete
✅ item - Complete
✅ material_request - Ready
✅ rfq - Ready
✅ rfq_supplier - Ready
✅ supplier_quotation - Ready
✅ purchase_order - Ready
✅ purchase_receipt - Ready
✅ purchase_invoice - Ready
✅ supplier_scorecard - Ready
```

### API Endpoints Plan
```
Material Requests:
  GET    /api/material-requests              - List all MRs
  POST   /api/material-requests              - Create MR
  GET    /api/material-requests/:id          - Get MR details
  PUT    /api/material-requests/:id          - Update MR
  DELETE /api/material-requests/:id          - Delete MR
  PATCH  /api/material-requests/:id/approve  - Approve MR
  PATCH  /api/material-requests/:id/reject   - Reject MR

RFQs:
  GET    /api/rfqs                           - List all RFQs
  POST   /api/rfqs                           - Create RFQ
  GET    /api/rfqs/:id                       - Get RFQ details
  PUT    /api/rfqs/:id                       - Update RFQ
  DELETE /api/rfqs/:id                       - Delete RFQ
  POST   /api/rfqs/:id/send                  - Send to suppliers
  GET    /api/rfqs/:id/responses             - Get supplier responses

Supplier Quotations:
  GET    /api/quotations                     - List all quotations
  POST   /api/quotations                     - Create quotation
  GET    /api/quotations/:id                 - Get quotation details
  PUT    /api/quotations/:id                 - Update quotation
  PATCH  /api/quotations/:id/accept          - Accept quotation
  PATCH  /api/quotations/:id/reject          - Reject quotation

Analytics:
  GET    /api/analytics/purchase-by-supplier
  GET    /api/analytics/purchase-trend
  GET    /api/analytics/procurement-tracker
  GET    /api/analytics/items-to-order
```

### Frontend Pages Plan
```
/buying/material-requests         - MR List
/buying/material-request/new      - Create MR
/buying/material-request/:id      - View/Edit MR

/buying/rfqs                      - RFQ List
/buying/rfq/new                   - Create RFQ
/buying/rfq/:id                   - View/Edit RFQ

/buying/quotations                - Quotation List
/buying/quotation/new             - Create Quotation
/buying/quotation/:id             - View Quotation

/buying/analytics                 - Analytics & Reports
/buying/procurement-tracker       - Open PO Tracker
```

### Complete Workflow
```
Department Request
    ↓
Material Request (Draft → Approved)
    ↓
Create RFQ (from approved MRs)
    ↓
Send to Suppliers
    ↓
Receive Quotations
    ↓
Compare & Select
    ↓
Create Purchase Order
    ↓
Receive Goods (GRN)
    ↓
Receive Invoice
    ↓
Process Payment
```