# 🧪 Production Module - API Testing Guide

## Setup

**Base URL**: `http://localhost:5000/api`

**Header**: All requests need:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## 1️⃣ Authentication (Get Token First)

### Register Production User
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "production@example.com",
  "fullName": "Production Manager",
  "password": "password123",
  "confirmPassword": "password123",
  "department": "production"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "email": "production@example.com",
    "full_name": "Production Manager",
    "department": "production"
  }
}
```

### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "production@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "email": "production@example.com",
    "full_name": "Production Manager",
    "department": "production"
  }
}
```

**✅ Copy the token and use in all subsequent requests**

---

## 2️⃣ Work Orders

### Create Work Order
```bash
POST /production/work-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "sales_order_id": "SO-001",
  "item_code": "ITEM-001",
  "quantity": 100,
  "unit_cost": 50.00,
  "required_date": "2024-01-31",
  "assigned_to_id": "OP-001",
  "priority": "high",
  "notes": "Rush order for customer XYZ"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Work order created successfully",
  "data": {
    "wo_id": "WO-1705340800000",
    "sales_order_id": "SO-001",
    "item_code": "ITEM-001",
    "quantity": 100,
    "unit_cost": 50.00,
    "total_cost": 5000.00,
    "status": "draft",
    "priority": "high"
  }
}
```

### Get All Work Orders
```bash
GET /production/work-orders
Authorization: Bearer <token>

# With filters:
GET /production/work-orders?status=in-progress&search=ITEM-001&assigned_to_id=OP-001
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "wo_id": "WO-1705340800000",
      "item_code": "ITEM-001",
      "item_name": "Aluminium Profile",
      "quantity": 100,
      "status": "draft",
      "priority": "high",
      "required_date": "2024-01-31"
    }
  ],
  "count": 1
}
```

### Update Work Order
```bash
PUT /production/work-orders/WO-1705340800000
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in-progress",
  "priority": "medium"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Work order updated successfully"
}
```

---

## 3️⃣ Production Plans

### Create Production Plan
```bash
POST /production/plans
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan_date": "2024-01-15",
  "week_number": 3,
  "planned_by_id": "EMP-001",
  "items": [
    {
      "work_order_id": "WO-1705340800000",
      "machine_id": "M-001",
      "operator_id": "OP-001",
      "scheduled_date": "2024-01-15",
      "shift_no": "1",
      "planned_quantity": 50,
      "estimated_hours": 4
    }
  ]
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Production plan created successfully",
  "data": {
    "plan_id": "PP-1705340800000",
    "plan_date": "2024-01-15",
    "week_number": 3,
    "status": "draft"
  }
}
```

### Get Production Plans
```bash
GET /production/plans
Authorization: Bearer <token>

# With filters:
GET /production/plans?status=approved&week_number=3
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "plan_id": "PP-1705340800000",
      "plan_date": "2024-01-15",
      "week_number": 3,
      "status": "approved",
      "total_items": 5
    }
  ],
  "count": 1
}
```

---

## 4️⃣ Production Entries (Daily Production)

### Create Production Entry
```bash
POST /production/entries
Authorization: Bearer <token>
Content-Type: application/json

{
  "work_order_id": "WO-1705340800000",
  "machine_id": "M-001",
  "operator_id": "OP-001",
  "entry_date": "2024-01-15",
  "shift_no": "1",
  "quantity_produced": 85,
  "quantity_rejected": 2,
  "hours_worked": 8,
  "remarks": "Normal production, minor issue on unit #42"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Production entry created successfully",
  "data": {
    "entry_id": "PE-1705340800000",
    "work_order_id": "WO-1705340800000",
    "quantity_produced": 85,
    "quantity_rejected": 2,
    "hours_worked": 8,
    "efficiency": 10.625,
    "quality_rate": 97.6
  }
}
```

### Get Production Entries
```bash
GET /production/entries
Authorization: Bearer <token>

# With filters:
GET /production/entries?entry_date=2024-01-15&machine_id=M-001&work_order_id=WO-1705340800000
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "entry_id": "PE-1705340800000",
      "wo_id": "WO-1705340800000",
      "machine_name": "Cutting Machine 1",
      "operator_name": "John Operator",
      "quantity_produced": 85,
      "quantity_rejected": 2,
      "hours_worked": 8,
      "shift_no": "1"
    }
  ],
  "count": 1
}
```

---

## 5️⃣ Rejections & Quality

### Record Rejection
```bash
POST /production/rejections
Authorization: Bearer <token>
Content-Type: application/json

{
  "production_entry_id": "PE-1705340800000",
  "rejection_reason": "dimensional_mismatch",
  "rejection_count": 2,
  "root_cause": "Calibration issue on cutting machine",
  "corrective_action": "Recalibrated machine and tested with test piece",
  "reported_by_id": "EMP-001"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Rejection recorded successfully",
  "data": {
    "rejection_id": "REJ-1705340800000",
    "production_entry_id": "PE-1705340800000",
    "rejection_reason": "dimensional_mismatch",
    "rejection_count": 2
  }
}
```

### Get Rejection Analysis
```bash
GET /production/rejections/analysis
Authorization: Bearer <token>

# With date range:
GET /production/rejections/analysis?date_from=2024-01-01&date_to=2024-01-31
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rejection_reason": "dimensional_mismatch",
      "count": 3,
      "total_quantity": 6,
      "avg_quantity": 2.0
    },
    {
      "rejection_reason": "surface_defect",
      "count": 2,
      "total_quantity": 4,
      "avg_quantity": 2.0
    }
  ]
}
```

---

## 6️⃣ Machines

### Create Machine
```bash
POST /production/machines
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Cutting Machine 1",
  "type": "cutting",
  "model": "CM-2000",
  "capacity": 200,
  "purchase_date": "2023-01-15",
  "cost": 50000,
  "maintenance_interval": 500
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Machine created successfully",
  "data": {
    "machine_id": "M-1705340800000",
    "name": "Cutting Machine 1",
    "type": "cutting",
    "status": "active"
  }
}
```

### Get Machines
```bash
GET /production/machines
Authorization: Bearer <token>

# With filters:
GET /production/machines?status=active&type=cutting
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "machine_id": "M-001",
      "name": "Cutting Machine 1",
      "type": "cutting",
      "model": "CM-2000",
      "capacity": 200,
      "status": "active"
    }
  ],
  "count": 1
}
```

---

## 7️⃣ Operators

### Create Operator
```bash
POST /production/operators
Authorization: Bearer <token>
Content-Type: application/json

{
  "employee_id": "EMP-001",
  "name": "John Operator",
  "qualification": "Diploma in Mechanical Engineering",
  "experience_years": 5,
  "machines_skilled_on": "M-001,M-002,M-003"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Operator created successfully",
  "data": {
    "operator_id": "OP-1705340800000",
    "name": "John Operator",
    "experience_years": 5,
    "status": "active"
  }
}
```

### Get Operators
```bash
GET /production/operators
Authorization: Bearer <token>

# With filters:
GET /production/operators?status=active
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "operator_id": "OP-001",
      "name": "John Operator",
      "qualification": "Diploma in Mechanical Engineering",
      "experience_years": 5,
      "status": "active"
    }
  ],
  "count": 1
}
```

---

## 8️⃣ Analytics

### Get Production Dashboard
```bash
GET /production/analytics/dashboard
Authorization: Bearer <token>

# For specific date:
GET /production/analytics/dashboard?date=2024-01-15
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "active_wo": 5,
    "total_produced": 425,
    "total_rejected": 8,
    "rejection_rate": 1.88,
    "total_hours": 40
  }
}
```

### Get Machine Utilization
```bash
GET /production/analytics/machine-utilization
Authorization: Bearer <token>

# With date range:
GET /production/analytics/machine-utilization?date_from=2024-01-01&date_to=2024-01-31
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "machine_id": "M-001",
      "machine_name": "Cutting Machine 1",
      "production_days": 20,
      "total_hours": 160,
      "total_produced": 3200,
      "utilization_percent": 83.33
    }
  ]
}
```

### Get Operator Efficiency
```bash
GET /production/analytics/operator-efficiency
Authorization: Bearer <token>

# With date range:
GET /production/analytics/operator-efficiency?date_from=2024-01-01&date_to=2024-01-31
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "operator_id": "OP-001",
      "operator_name": "John Operator",
      "production_days": 18,
      "total_produced": 1500,
      "total_rejected": 25,
      "units_per_hour": 10.42,
      "quality_score": 98.33
    }
  ]
}
```

---

## 🧪 Complete Testing Scenario

### Step 1: Create Resources
```bash
# 1. Create Machine
POST /production/machines
{
  "name": "Machine A",
  "type": "cutting",
  "capacity": 200,
  "purchase_date": "2024-01-01"
}
→ Save machine_id: M-001

# 2. Create Operator
POST /production/operators
{
  "employee_id": "EMP-001",
  "name": "Operator A",
  "experience_years": 5
}
→ Save operator_id: OP-001

# 3. Create Work Order
POST /production/work-orders
{
  "item_code": "ITEM-001",
  "quantity": 100,
  "unit_cost": 50,
  "required_date": "2024-01-31"
}
→ Save wo_id: WO-001
```

### Step 2: Create Production Entry
```bash
POST /production/entries
{
  "work_order_id": "WO-001",
  "machine_id": "M-001",
  "operator_id": "OP-001",
  "entry_date": "2024-01-15",
  "shift_no": "1",
  "quantity_produced": 85,
  "quantity_rejected": 2,
  "hours_worked": 8
}
→ Save entry_id: PE-001
```

### Step 3: Log Quality Issue
```bash
POST /production/rejections
{
  "production_entry_id": "PE-001",
  "rejection_reason": "dimensional_mismatch",
  "rejection_count": 2,
  "root_cause": "Calibration issue"
}
```

### Step 4: Verify Analytics
```bash
GET /production/analytics/machine-utilization?date_from=2024-01-15&date_to=2024-01-15
GET /production/analytics/operator-efficiency?date_from=2024-01-15&date_to=2024-01-15
GET /production/analytics/dashboard?date=2024-01-15
```

---

## 🐛 Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "message": "Missing required fields: item_code, quantity, unit_cost, required_date"
}
```

### 401 - Unauthorized
```json
{
  "error": "Invalid token"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "message": "Work order not found"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "message": "Error creating work order",
  "error": "Database connection failed"
}
```

---

## 📊 Performance Tips

1. **Batch Entries**: Post multiple entries using a loop
2. **Use Filters**: Filter results to reduce response size
3. **Date Ranges**: Limit analytics queries to recent periods
4. **Pagination**: Implement if response > 1000 records

## ✅ Validation Checklist

- [ ] All endpoints return correct status codes
- [ ] Error messages are clear
- [ ] Data persists after creation
- [ ] Filters work correctly
- [ ] Analytics calculations are accurate
- [ ] Authorization works properly
- [ ] Date handling works correctly
- [ ] Null values handled gracefully

---

**Happy Testing!** 🚀