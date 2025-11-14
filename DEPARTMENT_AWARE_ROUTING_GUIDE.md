# Department-Aware Routing & Navigation Guide

## 🎯 Overview

This document describes the **department-specific navigation and access control system** that ensures users only see and access pages relevant to their department.

---

## 🏗️ Architecture

### Component Structure

```
App.jsx (Main Router)
  ├── ProtectedRoute (Authentication Check)
  │   └── DepartmentLayout (Department-Aware Navigation)
  │       └── DepartmentProtectedRoute (Department Access Control)
  │           └── Page Component
```

### Three-Layer Security

1. **ProtectedRoute** - Checks if user is authenticated
2. **DepartmentLayout** - Provides department-filtered sidebar navigation
3. **DepartmentProtectedRoute** - Restricts page access by department

---

## 📋 Components Overview

### 1. DepartmentLayout.jsx

**Location:** `frontend/src/components/DepartmentLayout.jsx`

**Purpose:** Renders department-aware navigation sidebar and main layout

**Features:**
- ✅ Filters sidebar menu based on user's department
- ✅ Shows department badge with color coding
- ✅ Different menu items for each department
- ✅ Responsive mobile sidebar
- ✅ Dark mode support

**Department Menu Structure:**

#### 🔵 BUYING Department Menu
```
├── Dashboard
├── Buying Module
│   ├── Material Requests
│   ├── RFQs
│   ├── Quotations
│   ├── Purchase Orders
│   ├── Purchase Receipts
│   └── Purchase Invoices
├── Masters
│   ├── Suppliers
│   └── Items
└── Analytics
    └── Buying Analytics
```

#### 🟣 SELLING Department Menu
```
├── Dashboard
├── Selling Module
│   ├── Quotations
│   ├── Sales Orders
│   ├── Delivery Notes
│   ├── Sales Invoices
│   └── Customers
└── Analytics
    └── Sales Analytics
```

#### 🔴 ADMIN Department Menu
```
├── Dashboard
├── Buying Module (All)
├── Selling Module (All)
├── Masters
│   ├── Suppliers
│   └── Items
├── Analytics
│   ├── Buying Analytics
│   └── Sales Analytics
└── Administration
    ├── User Management
    └── Settings
```

### 2. DepartmentProtectedRoute.jsx

**Location:** `frontend/src/components/DepartmentProtectedRoute.jsx`

**Purpose:** Restricts page access based on user's department

**Usage:**
```jsx
<DepartmentProtectedRoute departments={['buying', 'admin']}>
  <MaterialRequests />
</DepartmentProtectedRoute>
```

**Parameters:**
- `departments`: Array of allowed departments
  - Examples: `['buying']`, `['selling', 'admin']`, `['admin']`

**Behavior:**
- ✅ If `departments` array is empty, allows all authenticated users
- ✅ If user's department is in the array, renders the page
- ❌ If user's department is not in the array, shows "Access Denied" message

---

## 🔀 Routing Rules

### Buying Pages (Restricted to Buying & Admin)
```
/buying/material-requests          → Material Requests list
/buying/material-requests/new      → Create new material request
/buying/material-request/:id       → Edit material request
/buying/rfqs                       → RFQ list
/buying/rfqs/new                   → Create new RFQ
/buying/rfq/:id                    → Edit RFQ
/buying/quotations                 → Supplier quotations list
/buying/quotations/new             → Create new quotation
/buying/quotation/:id              → Edit quotation
/buying/purchase-orders            → Purchase orders list
/buying/purchase-orders/new        → Create new PO
/buying/purchase-order/:po_no      → Edit PO
/buying/purchase-receipts          → Purchase receipts list
/buying/purchase-invoices          → Purchase invoices list
/analytics/buying                  → Buying analytics dashboard
/masters/suppliers                 → Supplier master list
/masters/items                     → Items master list
```

**Allowed Departments:** `['buying', 'admin']`

### Selling Pages (Restricted to Selling & Admin)
```
/selling/quotations                → Sales quotations list
/selling/quotations/new            → Create new quotation
/selling/quotations/:id            → Edit quotation
/selling/sales-orders              → Sales orders list
/selling/sales-orders/new          → Create new SO
/selling/sales-orders/:id          → Edit SO
/selling/delivery-notes            → Delivery notes list
/selling/delivery-notes/new        → Create new DN
/selling/delivery-notes/:id        → Edit DN
/selling/sales-invoices            → Sales invoices list
/selling/sales-invoices/new        → Create new SI
/selling/sales-invoices/:id        → Edit SI
/selling/customers                 → Customers list
/selling/customers/new             → Add new customer
/selling/customers/:id             → Edit customer
/analytics/selling                 → Sales analytics dashboard
```

**Allowed Departments:** `['selling', 'admin']`

### Public Pages (All Departments)
```
/dashboard                         → Department-specific dashboard
```

**Allowed Departments:** `All`

---

## 🎨 Department Badge Colors

Visual indicators for quick department identification:

```
🔵 Buying     → #4F46E5 (Indigo)
🟣 Selling    → #7C3AED (Purple)
🔴 Admin      → #DC2626 (Red)
```

The badge appears:
- User avatar background in sidebar
- Department label below user email in sidebar
- Dashboard header background
- All page headers and statistics cards

---

## 🔐 Access Control Flow

```
User visits /buying/material-requests
    ↓
ProtectedRoute checks: Is user authenticated?
    ├─ NO → Redirect to /login
    └─ YES ↓
DepartmentLayout renders:
    ├─ Filters sidebar menu based on user.department
    └─ Shows department badge
        ↓
DepartmentProtectedRoute checks: Is department allowed?
    ├─ NO → Show "Access Denied" message
    └─ YES ↓
Page renders (MaterialRequests component)
```

---

## 📝 Implementation Details

### How DepartmentLayout Filters Menu

```jsx
const getDepartmentMenuItems = () => {
  const userDept = user?.department?.toLowerCase() || 'buying'
  
  if (userDept === 'buying') {
    return [
      dashboardItem,
      { /* Buying module items */ },
      { /* Masters */ },
      { /* Buying analytics */ }
    ]
  }
  
  if (userDept === 'selling') {
    return [
      dashboardItem,
      { /* Selling module items */ },
      { /* Selling analytics */ }
    ]
  }
  
  if (userDept === 'admin') {
    // All items for admin
    return [
      dashboardItem,
      { /* All modules */ },
      { /* Administration */ }
    ]
  }
}
```

### How DepartmentProtectedRoute Validates Access

```jsx
const userDept = user?.department?.toLowerCase() || 'buying'
const allowedDepts = departments.map(d => d.toLowerCase())

if (!allowedDepts.includes(userDept)) {
  // Show access denied
  return <AccessDeniedMessage />
}

// Allow access
return children
```

---

## 🧪 Testing Department Access

### Test Scenario 1: Buying User Access
1. Register with department: **Buying**
2. Login
3. Verify sidebar shows:
   - ✅ Dashboard
   - ✅ Buying Module
   - ✅ Masters
   - ✅ Buying Analytics
4. Verify hidden:
   - ❌ Selling Module
   - ❌ Administration
5. Try to access `/selling/quotations`
   - ❌ Should show "Access Denied"

### Test Scenario 2: Selling User Access
1. Register with department: **Selling**
2. Login
3. Verify sidebar shows:
   - ✅ Dashboard
   - ✅ Selling Module
   - ✅ Sales Analytics
4. Verify hidden:
   - ❌ Buying Module
   - ❌ Masters
   - ❌ Administration
5. Try to access `/buying/material-requests`
   - ❌ Should show "Access Denied"

### Test Scenario 3: Admin User Access
1. Register with department: **Admin**
2. Login
3. Verify sidebar shows ALL items:
   - ✅ Dashboard
   - ✅ Buying Module
   - ✅ Selling Module
   - ✅ Masters
   - ✅ All Analytics
   - ✅ Administration
4. Can access any page without restrictions
   - ✅ `/buying/material-requests` → Allowed
   - ✅ `/selling/quotations` → Allowed
   - ✅ `/admin/users` → Allowed

---

## 🚀 Adding New Department Pages

### Step 1: Create the Page Component
```jsx
// frontend/src/pages/NewDepartment/NewPage.jsx
export default function NewPage() {
  return <div>New Page Content</div>
}
```

### Step 2: Add Route in App.jsx
```jsx
<Route
  path="/new-department/new-page"
  element={
    <ProtectedRoute>
      <DepartmentLayout>
        <DepartmentProtectedRoute departments={['new-dept', 'admin']}>
          <NewPage />
        </DepartmentProtectedRoute>
      </DepartmentLayout>
    </ProtectedRoute>
  }
/>
```

### Step 3: Add Menu Item in DepartmentLayout.jsx
```jsx
const getDepartmentMenuItems = () => {
  if (userDept === 'new-dept') {
    return [
      dashboardItem,
      {
        id: 'new-dept',
        label: 'New Department',
        icon: YourIcon,
        submenu: [
          { 
            label: 'New Page', 
            path: '/new-department/new-page', 
            icon: PageIcon 
          }
        ]
      }
    ]
  }
}
```

---

## 📊 Comparison: Before & After

### Before This Update
```
All users (Buying/Selling/Admin)
    ↓
Sidebar shows ALL pages (Buying + Selling)
    ↓
Users can access pages they shouldn't
    ↓
Dashboard was the only department-aware component
```

### After This Update
```
User Department → Determine Allowed Pages
    ↓
DepartmentLayout filters sidebar menu
    ↓
DepartmentProtectedRoute restricts access
    ↓
Only relevant pages show in navigation
    ↓
Users cannot access pages outside their department
```

---

## 🔧 Database Requirements

The `users` table must have a `department` column:

```sql
ALTER TABLE users ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT 'buying';
```

**Status:** ✅ Already added via migration script

**Run Migration:**
```bash
cd backend
node scripts/add-department-column.js
```

---

## 📱 Mobile Responsiveness

- Sidebar collapses to hamburger menu on screens ≤ 768px
- All department badges and colors remain visible
- Menu items are touch-friendly with proper spacing
- Department label shows beneath user email (mobile-optimized)

---

## 🌙 Dark Mode Support

All department colors are automatically adjusted for dark mode:
- Badge colors maintain contrast
- Sidebar background adapts
- Text colors adjust automatically
- All icons remain visible

---

## ✅ Checklist

- [x] DepartmentLayout component created
- [x] DepartmentProtectedRoute component created
- [x] All Buying routes wrapped with department protection
- [x] All Selling routes wrapped with department protection
- [x] Dashboard route allows all departments
- [x] Department badge displays in sidebar
- [x] Department menu filtering implemented
- [x] Access denied page shows for unauthorized access
- [x] Mobile responsive sidebar
- [x] Dark mode compatible
- [x] Documentation complete

---

## 🆘 Troubleshooting

### Issue: User can see all menu items
**Solution:**
1. Check user.department is set in AuthContext
2. Verify DepartmentLayout is wrapping the page
3. Clear browser cache and reload
4. Check localStorage for correct department

### Issue: "Access Denied" when trying to access allowed page
**Solution:**
1. Verify department is lowercase in check
2. Ensure departments array matches user.department
3. Check if admin user is included in array
4. Verify authentication token has department claim

### Issue: Sidebar not showing department badge
**Solution:**
1. Verify user.department is not null/undefined
2. Check getDepartmentBadgeColor() mapping
3. Ensure DepartmentLayout is rendered
4. Check CSS for department badge styling

---

## 📞 Support

For issues or questions about department routing:

1. Check the `DepartmentLayout.jsx` for menu structure
2. Check the `DepartmentProtectedRoute.jsx` for access logic
3. Verify routes in `App.jsx` have correct departments array
4. Test with different department users

---

**Last Updated:** 2024
**Status:** ✅ Production Ready