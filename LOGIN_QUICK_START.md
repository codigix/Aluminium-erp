# Login & Registration - Quick Start Guide

## 🎯 Before You Start

1. ✅ Backend running on `http://localhost:5000`
2. ✅ Frontend running on `http://localhost:5173`
3. ✅ MySQL database configured
4. ✅ Migration script executed: `node scripts/add-department-column.js`

---

## 🚀 Getting Started

### Step 1: Setup (Backend)

```bash
# Navigate to backend
cd backend

# Run migration to add department column
node scripts/add-department-column.js

# If not already running, start the server
npm start
```

**Expected Output:**
```
✅ Department column added successfully!
✅ All existing users updated!
✨ Migration completed successfully!
```

### Step 2: Test the System

**Open:** http://localhost:5173/login

You'll see the login/registration form with:
- Login Tab (default)
- Register Tab (new users)

---

## 👤 Creating a New User Account

### Step 1: Click "Register" Tab

![](Register tab at top of form)

### Step 2: Fill in Registration Form

**Fields:**
1. **Full Name** - Enter your name
2. **Department** - Select one of:
   - 🔵 Buying/Procurement
   - 🟣 Selling/Sales
   - 🔴 Administration
3. **Email** - Enter unique email
4. **Password** - Min 6 characters
5. **Confirm Password** - Must match password

### Step 3: Select Department

You can either:
1. **Use Dropdown** - Click select menu
2. **Click Visual Box** - Click colored department box

**Departments:**
- **🔵 Buying (Blue)** - Access to buying module, suppliers, RFQs, etc.
- **🟣 Selling (Purple)** - Access to selling module, customers, quotations, etc.
- **🔴 Admin (Red)** - System administration, user management, etc.

### Step 4: Click "Register"

System will:
1. Validate all fields
2. Check email uniqueness
3. Hash password
4. Create user in database with department
5. Generate JWT token
6. Redirect to dashboard

---

## 📊 Dashboard Views

After registration/login, you'll see department-specific dashboard:

### 🔵 Buying Module Dashboard

Shows:
- Material Requests count
- RFQs count
- Quotations count
- Suppliers count
- Purchase Orders count
- Invoices count

Quick Actions:
- Create Material Request
- Create RFQ
- Add Quotation
- View All Requests

### 🟣 Selling Module Dashboard

Shows:
- Active Quotations
- Sales Orders
- Delivery Notes
- Invoices
- Customers
- Total Sales

Quick Actions:
- Create Quotation
- Create Sales Order
- Add Customer
- View All Quotations

### 🔴 Admin Dashboard

Shows:
- Total Users
- Active Departments
- System Health
- Last Backup

Admin Actions:
- Manage Users
- Manage Departments
- System Settings
- View Reports

---

## 🔐 Logging In

### Existing User Login

1. Go to http://localhost:5173/login
2. Enter email and password
3. Click "Login"
4. Dashboard loads automatically with your department layout

**Demo Account:**
- Email: `test@example.com`
- Password: `password123`
- Department: `buying` (default)

---

## 📋 Complete Workflow Example

### Scenario: New Selling Department Employee

**Step 1: Register**
```
Name: Jane Smith
Department: Selling/Sales
Email: jane.smith@company.com
Password: SecurePass123
```

**Step 2: Click Register**
→ Account created
→ Redirected to Selling Dashboard

**Step 3: See Selling Dashboard**
- Shows: Quotations, Sales Orders, Deliveries, Invoices, Customers
- Can see: Total Sales = ₹9.5L
- Quick Actions for selling operations

**Step 4: Create Quotation**
- Click "Create Quotation" button
- Fill quotation details
- Send to customer

**Step 5: Track in Dashboard**
- Dashboard updates quotation count
- Can see quotation status
- Track conversion rate

---

## ⚙️ Technical Details

### Registration Flow

```
User fills form
         ↓
Frontend validates
         ↓
POST /api/auth/register
  {
    email: "user@email.com",
    fullName: "John Doe",
    password: "****",
    department: "buying"
  }
         ↓
Backend validates
         ↓
Hash password + validate department
         ↓
INSERT into users table
         ↓
Generate JWT (includes department)
         ↓
Return token + user info
         ↓
Frontend stores in localStorage
         ↓
Redirect to /dashboard
         ↓
DepartmentDashboard renders based on department
```

### Login Flow

```
User enters credentials
         ↓
POST /api/auth/login
  {
    email: "user@email.com",
    password: "****"
  }
         ↓
Backend authenticates
         ↓
Fetch user + department from database
         ↓
Generate JWT (includes department)
         ↓
Return token + user info
         ↓
Frontend stores in localStorage
         ↓
Redirect to /dashboard
         ↓
DepartmentDashboard shows correct layout
```

---

## 🧪 Quick Test Cases

### Test 1: Register All Departments

```
1. Register "buying_user" → Buying department → See Buying dashboard
2. Register "selling_user" → Selling department → See Selling dashboard
3. Register "admin_user" → Admin department → See Admin dashboard
```

### Test 2: Verify Department Persists

```
1. Register with "Selling" department
2. Login with same account
3. Verify dashboard shows Selling layout
4. Refresh page - still shows Selling layout
```

### Test 3: Try Invalid Department

```
1. Open browser console
2. Try: authService.register("email", "name", "pass", "pass", "invalid")
3. Should get error: "Invalid department"
```

---

## 🎨 UI Features

### Department Badge

Top-right of dashboard shows:
```
🔵 Buying Department
🟣 Selling Department
🔴 Admin Department
```

### Color Coding

- **Blue (#4F46E5)** = Buying/Procurement
- **Purple (#7C3AED)** = Selling/Sales
- **Red (#DC2626)** = Administration

### Responsive Design

- Works on desktop (full features)
- Works on tablet (responsive layout)
- Works on mobile (optimized buttons)
- Dark mode supported (automatic theme switching)

---

## 🔒 Security Notes

✅ **Password Hashing** - bcryptjs with 10 rounds  
✅ **JWT Token** - Expires in 7 days  
✅ **Token Storage** - localStorage (secure for modern browsers)  
✅ **Email Validation** - Checked for uniqueness  
✅ **Department Validation** - Only allowed values accepted  
✅ **Protected Routes** - All dashboards require authentication  

---

## 🐛 Common Issues & Solutions

### Issue: "Email already registered"

**Solution:** Use a different email address

### Issue: "Password must be at least 6 characters"

**Solution:** Enter password with 6+ characters

### Issue: Department not showing on dashboard

**Solution:** 
1. Check if migration script was run
2. Logout and login again
3. Clear browser cache
4. Restart frontend/backend

### Issue: "Invalid department" error

**Solution:** Department must be exactly:
- `buying`
- `selling`
- `admin`

(Case-sensitive)

### Issue: Login fails after registration

**Solution:**
1. Check email is correct
2. Check password is correct
3. Verify database has user
4. Check backend logs

### Issue: Can't see user info on dashboard

**Solution:**
1. Check user stored in localStorage
2. Open DevTools → Application → localStorage
3. Should see `user` key with JSON data
4. Should see `token` key with JWT

---

## 🧑‍💻 For Developers

### Access User Info in Components

```javascript
import { useAuth } from '../hooks/AuthContext'

export default function MyComponent() {
  const { user } = useAuth()
  
  // user object contains:
  // {
  //   user_id: 1,
  //   email: "user@example.com",
  //   full_name: "John Doe",
  //   department: "buying",  // NEW!
  //   is_active: true
  // }
  
  return <h1>Welcome, {user?.full_name}</h1>
}
```

### Check User Department

```javascript
const { user } = useAuth()

if (user?.department === 'selling') {
  // Show selling-specific content
}
```

### Add Department-Specific Route

```javascript
// In App.jsx
<Route
  path="/some-page"
  element={
    <ProtectedRoute>
      {user?.department === 'buying' ? <BuyingPage /> : <AccessDenied />}
    </ProtectedRoute>
  }
/>
```

---

## 📞 Need Help?

1. **Check Database** - Is department column there?
   ```sql
   DESC users;  -- Should show department column
   ```

2. **Check Migration** - Did it run successfully?
   ```bash
   node backend/scripts/add-department-column.js
   ```

3. **Check Network** - Open DevTools → Network tab
   - Look for registration/login requests
   - Check response for errors

4. **Check Console** - Open DevTools → Console
   - Look for JavaScript errors
   - Check if user object has department

5. **Check Backend Logs** - Look for error messages

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Can open http://localhost:5173/login
- [ ] Can see Register tab
- [ ] Can see Department selection field
- [ ] Can register with Buying department
- [ ] Can register with Selling department
- [ ] Can register with Admin department
- [ ] Dashboard shows correct layout per department
- [ ] Can login with registered credentials
- [ ] Department persists after refresh
- [ ] Department badge shows on dashboard
- [ ] Quick action links work

---

**Status:** ✅ Ready to Use  
**Last Updated:** 2024  
**Questions?** Check LOGIN_REGISTRATION_SETUP.md for detailed documentation