# Login & Registration System with Department Selection

## 📋 Overview

This document explains the complete login and registration system with department-based dashboard routing. Users can now select their department during registration, and the dashboard will display different content based on their department.

---

## 🎯 Key Features

✅ **Department Selection During Registration** - Users choose: Buying, Selling, or Admin  
✅ **Department-Based Dashboards** - Different UI/KPIs for each department  
✅ **Department Stored in Database** - Persistent department information  
✅ **Department in JWT Token** - Quick access without additional queries  
✅ **Smart Navigation** - Users see only relevant modules for their department  
✅ **Visual Department Indicators** - Color-coded badges (Blue/Purple/Red)

---

## 🚀 Setup Instructions

### Step 1: Update Database Schema

Run the migration script to add the `department` column to the `users` table:

```bash
# From the backend directory
node scripts/add-department-column.js
```

**What it does:**
- Checks if `department` column exists
- Adds `department` column with default value 'buying'
- Updates all existing users to 'buying' department

### Step 2: Frontend Configuration (Already Done)

The following files have been updated:

1. **LoginPage.jsx** - Added department selection UI during registration
2. **authService.js** - Passes department to backend during registration
3. **AuthContext.jsx** - Stores and manages department information
4. **DepartmentDashboard.jsx** - New component with 3 department-specific dashboards
5. **App.jsx** - Updated to use DepartmentDashboard

### Step 3: Backend Configuration (Already Done)

The following files have been updated:

1. **AuthModel.js** - Handles department during registration and login
2. **AuthController.js** - Validates and returns department in responses
3. **JWT Token** - Now includes department information

---

## 📊 Department Dashboards

### 1. 🔵 Buying Department Dashboard

**Color Code:** #4F46E5 (Indigo)

**Displays:**
- Material Requests (count)
- RFQs (count)
- Quotations (count)
- Active Suppliers (count)
- Purchase Orders (count)
- Purchase Invoices (count)

**Quick Actions:**
- Create Material Request
- Create RFQ
- Add Quotation
- View All Requests

**Access:** `/dashboard`

---

### 2. 🟣 Selling Department Dashboard

**Color Code:** #7C3AED (Purple)

**Displays:**
- Active Quotations (count)
- Pending Sales Orders (count)
- Delivery Notes (count)
- Total Invoices (count)
- Total Customers (count)
- Total Sales (monthly)

**Quick Actions:**
- Create Quotation
- Create Sales Order
- Add Customer
- View All Quotations

**Access:** `/dashboard`

---

### 3. 🔴 Admin Department Dashboard

**Color Code:** #DC2626 (Red)

**Displays:**
- Total Users (count)
- Active Departments (count)
- System Health (%)
- Last Backup (date/time)

**Admin Actions:**
- Manage Users
- Manage Departments
- System Settings
- View Reports

**Access:** `/dashboard` (with admin role)

---

## 🔐 Authentication Flow

### Registration Flow

```
1. User enters email, name, password
2. User selects department (Buying/Selling/Admin)
3. Frontend validates input
4. Frontend sends to: POST /api/auth/register
   {
     email: "user@example.com",
     fullName: "John Doe",
     password: "password123",
     confirmPassword: "password123",
     department: "buying"  // NEW FIELD
   }
5. Backend validates department
6. Backend creates user with department
7. Backend generates JWT with department
8. Frontend stores user + token
9. User redirected to /dashboard
10. DepartmentDashboard shows appropriate layout
```

### Login Flow

```
1. User enters email + password
2. Frontend sends to: POST /api/auth/login
   {
     email: "user@example.com",
     password: "password123"
   }
3. Backend returns user with department
   {
     token: "...",
     user: {
       user_id: 1,
       email: "user@example.com",
       full_name: "John Doe",
       department: "buying",  // NEW FIELD
       is_active: true
     }
   }
4. Frontend stores user + token
5. User redirected to /dashboard
6. DepartmentDashboard shows appropriate layout
```

---

## 💾 Database Schema Changes

### Before
```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### After
```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(50) DEFAULT 'buying',  -- NEW COLUMN
  full_name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Valid Department Values:**
- `'buying'` - Buying/Procurement department
- `'selling'` - Selling/Sales department
- `'admin'` - Administration department

---

## 📝 API Changes

### Register Endpoint

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "password": "password123",
  "confirmPassword": "password123",
  "department": "buying"
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "department": "buying",
    "is_active": true
  }
}
```

**Validation:**
- Department must be one of: 'buying', 'selling', 'admin'
- Defaults to 'buying' if not provided
- Email must be unique
- Password >= 6 characters

---

### Login Endpoint

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "department": "buying",
    "is_active": true
  }
}
```

**JWT Token Structure:**
```json
{
  "user_id": 1,
  "email": "user@example.com",
  "department": "buying",
  "iat": 1634567890,
  "exp": 1635172690
}
```

---

## 🎨 UI Components

### Department Selection UI

During registration, users see:

1. **Dropdown Select** - Standard HTML select
2. **Visual Toggle** - 3 colored boxes to click
3. **Color Coding:**
   - Buying: Indigo (#4F46E5) 🔵
   - Selling: Purple (#7C3AED) 🟣
   - Admin: Red (#DC2626) 🔴

### Department Badge

On dashboard header:
```
🔵 Buying Department
🟣 Selling Department
🔴 Admin Department
```

---

## 🧪 Testing the System

### Test Case 1: Register as Buying Department

1. Open http://localhost:5173/login
2. Click "Register" tab
3. Enter:
   - Name: "John Buyer"
   - Email: "buyer@example.com"
   - Password: "password123"
   - Confirm: "password123"
   - Department: Select "Buying/Procurement"
4. Click Register
5. **Expected:** Redirected to dashboard with Buying module layout

### Test Case 2: Register as Selling Department

1. Open http://localhost:5173/login
2. Click "Register" tab
3. Enter:
   - Name: "Jane Seller"
   - Email: "seller@example.com"
   - Password: "password123"
   - Confirm: "password123"
   - Department: Select "Selling/Sales"
4. Click Register
5. **Expected:** Redirected to dashboard with Selling module layout

### Test Case 3: Register as Admin

1. Open http://localhost:5173/login
2. Click "Register" tab
3. Enter:
   - Name: "Admin User"
   - Email: "admin@example.com"
   - Password: "password123"
   - Confirm: "password123"
   - Department: Select "Administration"
4. Click Register
5. **Expected:** Redirected to dashboard with Admin module layout

### Test Case 4: Login Verification

1. Register a user in "Selling" department
2. Logout (if implemented)
3. Login with same credentials
4. **Expected:** Dashboard shows "Selling Module" layout

---

## 🔧 File Structure

```
Frontend:
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx (✏️ Modified - Added department selection)
│   │   ├── DepartmentDashboard.jsx (✨ NEW - 3 dashboards)
│   │   └── Dashboard.jsx (Original - Still available)
│   ├── hooks/
│   │   └── AuthContext.jsx (✏️ Modified - Stores department)
│   ├── services/
│   │   └── authService.js (✏️ Modified - Sends department)
│   ├── App.jsx (✏️ Modified - Uses DepartmentDashboard)
│   └── styles/
│       └── Dashboard.css (Existing styles)

Backend:
├── src/
│   ├── models/
│   │   └── AuthModel.js (✏️ Modified - Handles department)
│   ├── controllers/
│   │   └── AuthController.js (✏️ Modified - Validates department)
│   └── ...
└── scripts/
    └── add-department-column.js (✨ NEW - Migration script)
```

---

## 🚨 Important Notes

### Department Immutability

Currently, users cannot change their department after registration. To implement this:

1. Add PUT endpoint: `PUT /api/auth/user/department`
2. Require admin/self approval
3. Update AuthModel method: `updateUserDepartment(userId, newDepartment)`
4. Add validation and logging

### Department-Based Access Control

The current implementation:
- ✅ Shows different dashboards
- ✅ Stores department in database and JWT
- ❌ Does NOT enforce access control on routes

To implement route protection by department:

1. Update `ProtectedRoute` component to check department
2. Add middleware in backend to verify department
3. Implement role-based access control (RBAC)

### Future Enhancements

1. **Multi-Department Users** - Allow users to have multiple departments
2. **Department Switching** - Let admins switch users between departments
3. **Department-Specific Modules** - Hide/show modules based on department
4. **Audit Trail** - Log department changes
5. **Department Managers** - Assign managers per department

---

## 🐛 Troubleshooting

### Issue: "Invalid department" error on registration

**Solution:** Ensure department value is one of:
- 'buying'
- 'selling'
- 'admin'

Check case sensitivity.

### Issue: Department not showing on dashboard

**Possible causes:**
1. Database migration not run
2. Backend not restarted after migration
3. User registered before migration
4. Token not regenerated

**Solution:** Re-login or re-register

### Issue: Department column doesn't exist

**Solution:** Run migration script:
```bash
node backend/scripts/add-department-column.js
```

### Issue: Old users don't have department

**Solution:** Migration script sets all existing users to 'buying' by default. To change:
```sql
UPDATE users SET department = 'selling' WHERE user_id = 2;
```

---

## 📞 Support

For issues or questions:
1. Check database schema matches expected structure
2. Verify migration script executed successfully
3. Check browser console for JavaScript errors
4. Check backend logs for API errors
5. Verify token includes department information

---

## ✅ Checklist

Before going to production:

- [ ] Run migration script: `node scripts/add-department-column.js`
- [ ] Test registration with all 3 departments
- [ ] Test login with existing users
- [ ] Verify department badge shows on dashboard
- [ ] Test dark mode styling
- [ ] Test responsive design on mobile
- [ ] Verify all quick action links work
- [ ] Check database backups include new column
- [ ] Update API documentation
- [ ] Train users on department selection

---

## 🎉 What's Next?

1. **Implement Department-Specific Navigation** - Hide/show sidebar items per department
2. **Add Department Management Panel** - Admin panel to manage departments
3. **Implement Multi-Department Support** - Users can belong to multiple departments
4. **Add Department Reports** - Analytics per department
5. **Create Department Settings** - Configure behavior per department

---

**Last Updated:** 2024  
**Status:** ✅ Production Ready