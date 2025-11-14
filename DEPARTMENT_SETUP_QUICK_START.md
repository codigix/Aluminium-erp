# Department-Aware Routing: Quick Start (5 Minutes)

## ⚡ TL;DR - Just Do This

### 1. Clear Browser Cache (30 seconds)
```
Press Ctrl + Shift + R (Hard Refresh)
OR
F12 → Right-click Refresh → "Empty cache and hard refresh"
```

### 2. Stop & Restart Frontend Server (1 minute)
```powershell
# In your frontend terminal:
Ctrl + C  (stop the server)
npm run dev
```

### 3. Test All Three Departments (2 minutes)

#### Test 1: 🔵 BUYING Department
1. Go to http://localhost:5173/login
2. Click "Register"
3. Fill form:
   - Email: `buying@test.com`
   - Password: `password123`
   - Department: Click **🔵 Buying/Procurement** button
4. Click Register
5. **Verify:**
   - ✅ Dashboard shows Buying layout with procurement cards
   - ✅ Sidebar shows ONLY: Dashboard, Buying Module, Masters, Analytics
   - ✅ Try `/selling/quotations` → See "Access Denied" ❌
   - ✅ User avatar has BLUE background

#### Test 2: 🟣 SELLING Department
1. Logout (click Logout in sidebar)
2. Click "Register" again
3. Fill form:
   - Email: `selling@test.com`
   - Password: `password123`
   - Department: Click **🟣 Selling/Sales** button
4. Click Register
5. **Verify:**
   - ✅ Dashboard shows Selling layout with sales cards
   - ✅ Sidebar shows ONLY: Dashboard, Selling Module, Analytics
   - ✅ Try `/buying/material-requests` → See "Access Denied" ❌
   - ✅ User avatar has PURPLE background

#### Test 3: 🔴 ADMIN Department
1. Logout
2. Click "Register" again
3. Fill form:
   - Email: `admin@test.com`
   - Password: `password123`
   - Department: Click **🔴 Administration** button
4. Click Register
5. **Verify:**
   - ✅ Dashboard shows Admin layout with all metrics
   - ✅ Sidebar shows ALL items: Dashboard, Buying, Selling, Masters, Analytics, Admin
   - ✅ Can access `/buying/material-requests` → Works ✅
   - ✅ Can access `/selling/quotations` → Works ✅
   - ✅ User avatar has RED background

---

## 🎯 What Changed?

### New Components Added
```
✨ DepartmentLayout.jsx          → Department-aware navigation sidebar
✨ DepartmentProtectedRoute.jsx  → Page access control by department
```

### Updated Files
```
📝 App.jsx                       → Wraps all routes with DepartmentLayout
```

### New Documentation
```
📚 DEPARTMENT_AWARE_ROUTING_GUIDE.md    → Complete technical details
📚 DEPARTMENT_SETUP_QUICK_START.md      → This file (quick reference)
```

---

## 🏗️ How It Works

### User Login
```
User logs in as Buying/Selling/Admin
    ↓
Department stored in JWT token + localStorage
    ↓
AuthContext updates with user.department
```

### Navigation Filter
```
DepartmentLayout reads user.department
    ↓
Filters sidebar menu → Shows only relevant pages
    ↓
Badge shows department color
```

### Page Access Control
```
User clicks link or types URL
    ↓
DepartmentProtectedRoute checks user.department
    ↓
If allowed → Show page ✅
If not allowed → Show "Access Denied" ❌
```

---

## 📊 Department-Specific Menus

### 🔵 Buying Department
**Sees in Sidebar:**
- Dashboard
- Buying Module
  - Material Requests
  - RFQs
  - Quotations
  - Purchase Orders
  - Purchase Receipts
  - Purchase Invoices
- Masters
  - Suppliers
  - Items
- Analytics
  - Buying Analytics

**Blocked:**
- All Selling pages
- Admin section

---

### 🟣 Selling Department
**Sees in Sidebar:**
- Dashboard
- Selling Module
  - Quotations
  - Sales Orders
  - Delivery Notes
  - Sales Invoices
  - Customers
- Analytics
  - Sales Analytics

**Blocked:**
- All Buying pages
- Masters
- Admin section

---

### 🔴 Admin Department
**Sees in Sidebar:**
- ✅ EVERYTHING
- Dashboard
- Buying Module (all pages)
- Selling Module (all pages)
- Masters (all items)
- Analytics (all types)
- Administration (future admin pages)

**Can Access:**
- ✅ All routes
- ✅ All pages
- ✅ All data

---

## 🔐 Access Rules

### Buying Pages Restricted To:
✅ Buying department users  
✅ Admin users  
❌ Selling department users

**Examples:**
- `/buying/material-requests` - Buying + Admin only
- `/buying/purchase-orders` - Buying + Admin only
- `/buying/rfqs` - Buying + Admin only

### Selling Pages Restricted To:
✅ Selling department users  
✅ Admin users  
❌ Buying department users

**Examples:**
- `/selling/quotations` - Selling + Admin only
- `/selling/sales-orders` - Selling + Admin only
- `/selling/customers` - Selling + Admin only

### Dashboard (No Restrictions):
✅ All department users  

**Different layouts per department:**
- Buying user → Buying dashboard (procurement cards)
- Selling user → Selling dashboard (sales cards)
- Admin user → Admin dashboard (system overview)

---

## 🧪 Quick Tests

### Test 1: Menu Filtering
```
✅ Buying user → Only Buying menu visible
✅ Selling user → Only Selling menu visible
✅ Admin user → All menus visible
```

### Test 2: Direct URL Access
```
✅ Buying user types /selling/quotations → Access Denied ❌
✅ Selling user types /buying/material-requests → Access Denied ❌
✅ Admin user types /buying/* → Works ✅
✅ Admin user types /selling/* → Works ✅
```

### Test 3: Department Badge
```
✅ Buying user → Blue user avatar in sidebar
✅ Selling user → Purple user avatar in sidebar
✅ Admin user → Red user avatar in sidebar
✅ Logout → Badge disappears
```

### Test 4: Page Refresh
```
✅ Buying user refreshes page → Department persists
✅ Selling user refreshes page → Department persists
✅ Admin user refreshes page → Department persists
✅ Menu structure remains filtered
```

---

## 🚨 Common Issues & Fixes

### Issue: All menus still visible
**Quick Fix:**
1. Hard refresh: `Ctrl + Shift + R`
2. Restart frontend: `npm run dev`
3. Clear localStorage: F12 → Console → `localStorage.clear()`
4. Reload page

### Issue: Can access pages from other departments
**Quick Fix:**
1. Verify DepartmentLayout wraps the page in App.jsx
2. Check DepartmentProtectedRoute has correct departments array
3. Check App.jsx hasn't been reverted

### Issue: User avatar has wrong color
**Quick Fix:**
1. Check user.department in localStorage
2. Check getDepartmentBadgeColor() in DepartmentLayout.jsx
3. Verify database has department column

### Issue: "Access Denied" on all pages
**Quick Fix:**
1. Check user.department is set
2. Verify browser has localStorage access
3. Try private/incognito window
4. Check JWT token has department claim

---

## 📂 File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── DepartmentLayout.jsx          ← NEW
│   │   ├── DepartmentProtectedRoute.jsx  ← NEW
│   │   ├── Sidebar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── pages/
│   │   ├── Buying/
│   │   ├── Selling/
│   │   └── DepartmentDashboard.jsx
│   └── App.jsx                            ← UPDATED
└── ...

Documentation/
├── DEPARTMENT_AWARE_ROUTING_GUIDE.md      ← NEW (Detailed)
└── DEPARTMENT_SETUP_QUICK_START.md        ← NEW (This file)
```

---

## ✅ Verification Checklist

- [ ] Browser cache cleared (hard refresh)
- [ ] Frontend server restarted
- [ ] Buying user can login and see Buying dashboard
- [ ] Selling user can login and see Selling dashboard
- [ ] Admin user can login and see Admin dashboard
- [ ] Buying user sidebar shows only Buying menu
- [ ] Selling user sidebar shows only Selling menu
- [ ] Admin user sidebar shows all menus
- [ ] Buying user cannot access Selling pages (Access Denied)
- [ ] Selling user cannot access Buying pages (Access Denied)
- [ ] Admin user can access any page
- [ ] Department badge colors are correct
- [ ] Department persists on page refresh
- [ ] All icons display correctly
- [ ] Dark mode works with department colors

---

## 🎓 Next Steps

1. **Test the system** using the steps above
2. **Read detailed docs** in `DEPARTMENT_AWARE_ROUTING_GUIDE.md`
3. **Add new pages** by wrapping with `DepartmentProtectedRoute`
4. **Customize menus** in `DepartmentLayout.jsx`
5. **Monitor access logs** for unauthorized access attempts

---

## 📞 Support

**Having issues?**

1. Check browser console for errors
2. Verify database has department column
3. Clear cache and restart servers
4. Check `DEPARTMENT_AWARE_ROUTING_GUIDE.md` troubleshooting section

**Want to customize?**

1. Department colors → See `DepartmentLayout.jsx` `getDepartmentBadgeColor()`
2. Menu items → See `DepartmentLayout.jsx` `getDepartmentMenuItems()`
3. Access rules → Update `departments` array in `App.jsx` route definitions

---

**Status:** ✅ Ready to Test!

**Time to Set Up:** 5 minutes  
**Time to Verify:** 10 minutes  
**Total:** ~15 minutes

👉 **Start testing now!** 👈