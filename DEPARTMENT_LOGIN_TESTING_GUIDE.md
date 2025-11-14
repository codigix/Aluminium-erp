# Department Login & Testing Guide

## 🎯 Complete Department-Wise Login System

This guide provides all login credentials and testing information for the **10-Department Aluminium ERP System**.

---

## 📊 All Available Departments

| Department | Code | Color | Emoji | Status |
|-----------|------|-------|-------|--------|
| Buying/Procurement | `buying` | Blue `#4F46E5` | 🔵 | ✅ Active |
| Selling/Sales | `selling` | Purple `#7C3AED` | 🟣 | ✅ Active |
| Inventory/Stock | `inventory` | Green `#059669` | 🟢 | ✅ Active |
| Production/Manufacturing | `production` | Amber `#F59E0B` | 🟡 | ✅ Active |
| Tool Room/Maintenance | `toolroom` | Violet `#8B5CF6` | 🟣 | ✅ Active |
| Quality Control/QC | `quality` | Cyan `#06B6D4` | 🔵 | ✅ Active |
| Dispatch/Logistics | `dispatch` | Pink `#EC4899` | 🟩 | ✅ Active |
| Accounts/Finance | `accounts` | Teal `#14B8A6` | 🟢 | ✅ Active |
| HR/Payroll | `hr` | Blue `#3B82F6` | 🔵 | ✅ Active |
| Administration | `admin` | Red `#DC2626` | 🔴 | ✅ Active |

---

## 🔐 Demo Credentials

### Default Test Credentials
```
Email:    test@example.com
Password: password123
```

All departments can be registered with the same email by using the department selector during registration.

---

## 🚀 How to Test Each Department

### Step 1: Access Login Page
1. Navigate to `http://localhost:3000/login` (or your frontend URL)
2. Click on **Register** tab

### Step 2: Create Department User
- **Full Name**: `[Your Name] - [Department]`
- **Email**: `[department]@example.com` (e.g., `buying@example.com`, `production@example.com`)
- **Password**: `password123`
- **Department**: Select from the grid or dropdown
- Click **Register**

### Step 3: Login & Access Dashboard
- Use the registered credentials to login
- Each department has a custom dashboard with relevant KPIs and actions

---

## 📋 Department-Specific Testing Credentials

### 1️⃣ BUYING/PROCUREMENT
```
Email:    buying@example.com
Password: password123
Department: buying
Dashboard URL: /dashboard
Features: 
  - Material Requests
  - RFQs
  - Supplier Quotations
  - Purchase Orders
  - Purchase Receipts
  - Purchase Invoices
```

### 2️⃣ SELLING/SALES
```
Email:    selling@example.com
Password: password123
Department: selling
Dashboard URL: /dashboard
Features:
  - Quotations
  - Sales Orders
  - Delivery Notes
  - Sales Invoices
  - Customer Management
  - Sales Analytics
```

### 3️⃣ INVENTORY/STOCK
```
Email:    inventory@example.com
Password: password123
Department: inventory
Dashboard URL: /dashboard
Features:
  - Warehouse Management
  - Stock Balance
  - Stock Entries
  - Stock Ledger
  - Stock Transfers
  - Batch Tracking
  - Reconciliation
  - Reorder Management
```

### 4️⃣ PRODUCTION/MANUFACTURING
```
Email:    production@example.com
Password: password123
Department: production
Dashboard URL: /dashboard
Features:
  - Production Orders
  - Production Schedules
  - Batch Tracking
  - Quality Records
  - Production Analytics
Dashboard Stats:
  - Active Orders: 12
  - Completed Today: 8
  - In Progress: 5
  - Quality Rate: 98.5%
  - Line Efficiency: 92%
  - Downtime: 0.5h
```

### 5️⃣ TOOL ROOM/MAINTENANCE
```
Email:    toolroom@example.com
Password: password123
Department: toolroom
Dashboard URL: /dashboard
Features:
  - Tool Master Management
  - Die Register
  - Maintenance Scheduling
  - Rework Logs
  - Tool Analytics
Dashboard Stats:
  - Total Tools: 285
  - Dies In Use: 42
  - Maintenance Due: 8
  - Utilization Rate: 87%
  - Downtime: 2.5h
```

### 6️⃣ QUALITY CONTROL/QC
```
Email:    quality@example.com
Password: password123
Department: quality
Dashboard URL: /dashboard
Features:
  - Inspection Management
  - Defects Log
  - Quality Reports
  - Certifications
  - Quality Analytics
Dashboard Stats:
  - Daily Inspections: 45
  - Passed: 44
  - Rejected: 1
  - Defect Rate: 2.2%
  - Samples Checked: 320
  - Valid Certifications: 98
```

### 7️⃣ DISPATCH/LOGISTICS
```
Email:    dispatch@example.com
Password: password123
Department: dispatch
Dashboard URL: /dashboard
Features:
  - Shipment Management
  - Route Planning
  - Vehicle Fleet Management
  - Shipment Tracking
  - Dispatch Analytics
Dashboard Stats:
  - Pending Shipments: 8
  - Shipped Today: 15
  - Delivered (Month): 42
  - In Transit: 6
  - Active Routes: 12
  - Active Fleet: 8 vehicles
```

### 8️⃣ ACCOUNTS/FINANCE
```
Email:    accounts@example.com
Password: password123
Department: accounts
Dashboard URL: /dashboard
Features:
  - Invoice Management
  - Payment Recording
  - Financial Statements
  - Financial Reports
  - Account Analytics
Dashboard Stats:
  - Monthly Revenue: ₹25L
  - Monthly Expenses: ₹18L
  - Net Profit: ₹7L
  - Total Invoices: 145
  - Payments Received: 89
  - Ledger Accounts: 45
```

### 9️⃣ HR/PAYROLL
```
Email:    hr@example.com
Password: password123
Department: hr
Dashboard URL: /dashboard
Features:
  - Employee Management
  - Attendance Tracking
  - Payroll Processing
  - Leave Management
  - HR Analytics
Dashboard Stats:
  - Total Employees: 125
  - Attendance Rate: 94.5%
  - Pending Salaries: 45
  - Leave Applications: 12
  - Performance Reviews: 8
  - Scheduled Trainings: 3
```

### 🔟 ADMINISTRATION
```
Email:    admin@example.com
Password: password123
Department: admin
Dashboard URL: /dashboard
Features:
  - Full System Access
  - All Department Modules
  - User Management
  - System Settings
  - Global Analytics
  - Viewing Access to all modules
Dashboard Stats:
  - Total Users: 25
  - Active Departments: All 10
  - System Health: 98%
  - Last Backup: Today 3:45 PM
```

---

## 🎨 Department Dashboard Features

### Common Dashboard Elements for All Departments:
1. **Department Badge** - Color-coded identifier
2. **KPI Cards** - 6 department-specific metrics
3. **Quick Actions** - Fast navigation buttons
4. **Activity Section** - Recent transactions log
5. **Analytics** - Department-specific reports

### Example Dashboard for Production:
- Active Orders: 12
- Completed Today: 8
- In Progress: 5
- Quality Rate: 98.5% ✓
- Downtime: 0.5h
- Efficiency: 92%

---

## 🧭 Navigation & Routing

### Department-Specific Routes

#### Buying Module
```
/dashboard           - Main dashboard
/buying/material-requests
/buying/rfqs
/buying/quotations
/buying/purchase-orders
/buying/purchase-receipts
/buying/purchase-invoices
/buying/items
/masters/suppliers
/analytics/buying
```

#### Selling Module
```
/dashboard           - Main dashboard
/selling/quotations
/selling/sales-orders
/selling/delivery-notes
/selling/sales-invoices
/selling/customers
/analytics/selling
```

#### Inventory Module
```
/dashboard           - Main dashboard
/inventory/warehouses
/inventory/stock-balance
/inventory/stock-entries
/inventory/stock-ledger
/inventory/stock-transfers
/inventory/batch-tracking
/inventory/reconciliation
/inventory/reorder-management
/analytics/inventory
```

#### Production Module
```
/dashboard           - Main dashboard
/production/orders
/production/schedules
/production/batch-tracking
/production/quality
/analytics/production
```

#### Tool Room Module
```
/dashboard           - Main dashboard
/toolroom/tools
/toolroom/die-register
/toolroom/maintenance
/toolroom/reworks
/analytics/toolroom
```

#### Quality Control Module
```
/dashboard           - Main dashboard
/quality/inspections
/quality/defects
/quality/reports
/quality/certifications
/analytics/quality
```

#### Dispatch Module
```
/dashboard           - Main dashboard
/dispatch/shipments
/dispatch/routes
/dispatch/vehicles
/dispatch/tracking
/analytics/dispatch
```

#### Accounts Module
```
/dashboard           - Main dashboard
/accounts/invoices
/accounts/payments
/accounts/statements
/accounts/reports
/analytics/accounts
```

#### HR Module
```
/dashboard           - Main dashboard
/hr/employees
/hr/attendance
/hr/payroll
/hr/leaves
/analytics/hr
```

#### Admin Module (Full Access)
```
/dashboard           - Main dashboard
All above routes accessible
/admin/users
/admin/settings
/admin/system
```

---

## 🧪 Testing Scenarios

### Scenario 1: Multi-Department User Testing
1. Register user as BUYING department
2. Login and verify dashboard
3. Logout and login with same email as PRODUCTION
4. Verify dashboard changes to production view

### Scenario 2: Department-Specific Navigation
1. Login as QUALITY control user
2. Verify sidebar shows only QC-related menu items
3. Attempt to access BUYING route → should be restricted
4. Verify Analytics tab shows QC Analytics

### Scenario 3: Admin Full Access
1. Login as ADMIN user
2. Verify all 10 departments visible in sidebar
3. Access any module route
4. Verify user and department badge displays correctly

### Scenario 4: Department Colors
Test that each department displays correct color:
- Buying: Blue #4F46E5
- Selling: Purple #7C3AED
- Inventory: Green #059669
- Production: Amber #F59E0B
- Toolroom: Violet #8B5CF6
- Quality: Cyan #06B6D4
- Dispatch: Pink #EC4899
- Accounts: Teal #14B8A6
- HR: Blue #3B82F6
- Admin: Red #DC2626

---

## 🔧 Backend Integration

### API Endpoints for Testing
```
POST /api/auth/register          - Register new user
POST /api/auth/login             - Login user
GET  /api/auth/verify            - Verify token
POST /api/auth/logout            - Logout user
GET  /api/users/profile          - Get user profile
```

### Department Validation
Backend validates all 10 departments:
- `buying`
- `selling`
- `inventory`
- `production`
- `toolroom`
- `quality`
- `dispatch`
- `accounts`
- `hr`
- `admin`

---

## ✨ Key Features

### ✅ Implemented
- [x] 10 Department Login System
- [x] Department-Specific Dashboards
- [x] Color-Coded Departments
- [x] Role-Based Navigation
- [x] Protected Routes per Department
- [x] Department Layout with Sidebars
- [x] Quick Action Buttons
- [x] KPI Cards (6 per department)
- [x] Analytics Routes
- [x] Theme Support

### 🚀 Ready for Frontend Development
- [x] Login/Registration Pages
- [x] Department Dashboards (all 10)
- [x] Navigation System
- [x] Route Protection

---

## 📝 Quick Start

### Option 1: Use Existing Demo User
```
Email:    test@example.com
Password: password123
Department: buying (or any other)
```

### Option 2: Register New Department User
1. Go to `/login`
2. Click "Register"
3. Enter name, email, select department
4. Use password: `password123`
5. Click Register
6. Automatically logged in

### Option 3: Testing All Departments
Use one email, register multiple times with different departments:
```
Email: myemail@company.com
Passwords: password123

Repeat 10 times with different departments:
- buying
- selling
- inventory
- production
- toolroom
- quality
- dispatch
- accounts
- hr
- admin
```

---

## 🎓 Department Dashboard Quick Reference

| Department | KPI 1 | KPI 2 | KPI 3 | KPI 4 | KPI 5 | KPI 6 |
|-----------|-------|-------|-------|-------|-------|-------|
| **Buying** | Material Requests | RFQs | Quotations | Suppliers | POs | Invoices |
| **Selling** | Quotations | Sales Orders | Deliveries | Invoices | Customers | Revenue |
| **Inventory** | Warehouses | Stock Items | Low Stock | Movements | Transfers | Reconciliations |
| **Production** | Active Orders | Completed | In Progress | Quality Rate | Downtime | Efficiency |
| **Toolroom** | Total Tools | Dies In Use | Maintenance Due | Utilization | Reworks | Downtime |
| **Quality** | Inspections | Passed | Rejected | Defect Rate | Samples | Certifications |
| **Dispatch** | Pending | Shipped | Delivered | In Transit | Routes | Vehicles |
| **Accounts** | Revenue | Expenses | Profit | Invoices | Payments | Accounts |
| **HR** | Employees | Attendance | Salaries | Leaves | Reviews | Trainings |
| **Admin** | Users | Departments | Health | Backup | - | - |

---

## 🆘 Troubleshooting

### Can't register with a department?
- Ensure department name matches the list (all lowercase)
- Check backend is running on port 5000
- Verify MySQL connection in backend

### Dashboard not loading?
- Clear browser cache and localStorage
- Verify token is in localStorage
- Check API endpoints in browser console
- Ensure backend is running

### Wrong department displaying?
- Logout completely (clear localStorage)
- Login again with correct credentials
- Verify department in user profile

### Colors not matching?
- Check if theme is set to dark mode (may invert colors)
- Clear cache and reload page
- Verify CSS is properly loaded

---

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify backend API is running
3. Check database connection
4. Review backend logs for department validation errors

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: ✅ All 10 Departments Active
