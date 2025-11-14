# Department-Aware System - Architecture Diagram

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION ENTRY POINT                      │
│                        App.jsx (Router)                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ↓                             ↓
        ┌──────────────────┐      ┌──────────────────┐
        │  Public Routes   │      │ Protected Routes │
        ├──────────────────┤      ├──────────────────┤
        │ /login           │      │ /dashboard       │
        │ (LoginPage)      │      │ (Dashboard)      │
        └──────────────────┘      └────────┬─────────┘
                                           │
                                           ↓
                        ┌──────────────────────────────────┐
                        │    ProtectedRoute Component      │
                        ├──────────────────────────────────┤
                        │  ✓ Check: Is user authenticated? │
                        │  ├─ NO  → Redirect to /login     │
                        │  └─ YES → Continue               │
                        └──────────────┬───────────────────┘
                                       │
                                       ↓
                        ┌──────────────────────────────────┐
                        │   DepartmentLayout Component     │
                        ├──────────────────────────────────┤
                        │  ✓ Filter sidebar menu           │
                        │  ✓ Show department badge         │
                        │  ✓ Display color-coded avatar    │
                        │                                   │
                        │  Based on user.department:       │
                        │  ├─ 'buying'   → Buying menu    │
                        │  ├─ 'selling'  → Selling menu   │
                        │  └─ 'admin'    → Full menu      │
                        └──────────────┬───────────────────┘
                                       │
                                       ↓
                 ┌─────────────────────────────────────────┐
                 │        Sidebar Navigation               │
                 ├─────────────────────────────────────────┤
                 │ [👤 User] [Department Badge]            │
                 │ ────────────────────────────────         │
                 │ [Dashboard]                             │
                 │ [Department-Specific Modules]           │
                 │ [Filtered Menu Items]                   │
                 │ ────────────────────────────────         │
                 │ [🌙 Theme] [🚪 Logout]                 │
                 └─────────────────────────────────────────┘
                                       │
                                       ↓ (User clicks item)
                        ┌──────────────────────────────────┐
                        │  DepartmentProtectedRoute        │
                        ├──────────────────────────────────┤
                        │  ✓ Check: Department allowed?    │
                        │                                   │
                        │  For each route:                 │
                        │  Departments: ['buying','admin'] │
                        │                                   │
                        │  ├─ User dept in array           │
                        │  │  └─ YES → Render page ✅      │
                        │  │                                │
                        │  └─ User dept NOT in array       │
                        │     └─ NO → Access Denied ❌     │
                        └──────────────┬───────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────┐
            │                                                  │
            ↓ ALLOWED                                          ↓ DENIED
    ┌──────────────────┐                            ┌──────────────────┐
    │ Component Render │                            │  Access Denied   │
    ├──────────────────┤                            │     Page         │
    │ [Page Content]   │                            ├──────────────────┤
    │                  │                            │  🚫 Access Denied│
    │ Full page with   │                            │  This page is    │
    │ sidebar + data   │                            │  only available  │
    │                  │                            │  for: [Dept]     │
    │ USER SEES ✅     │                            │  Your dept: [X]  │
    └──────────────────┘                            │  USER BLOCKED ❌ │
                                                    └──────────────────┘
```

---

## 🔀 Department Filter Flow

```
┌──────────────────────────────┐
│   User Department: 'buying'  │
└────────────┬─────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│  getDepartmentMenuItems() Function                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  if (userDept === 'buying') {                       │
│    return [                                         │
│      { Dashboard },                                 │
│      { Buying Module [                             │
│        Material Requests,                          │
│        RFQs,                                       │
│        Quotations,                                 │
│        Purchase Orders,                            │
│        Purchase Receipts,                          │
│        Purchase Invoices                           │
│      ]},                                           │
│      { Masters [Suppliers, Items] },              │
│      { Analytics [Buying Analytics] }             │
│    ]                                               │
│  }                                                 │
│                                                     │
│  else if (userDept === 'selling') { ... }          │
│  else if (userDept === 'admin') { ... }            │
│                                                     │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│   Sidebar Rendered with           │
│   Filtered Menu Items Only         │
│                                    │
│  ✅ Dashboard                      │
│  ✅ Buying Module                  │
│  ✅ Masters                        │
│  ✅ Analytics                      │
│                                    │
│  ❌ Selling Module (Hidden)        │
│  ❌ Admin Section (Hidden)         │
└──────────────────────────────────┘
```

---

## 🔐 Access Control Decision Tree

```
                    User requests page
                           │
                           ↓
            Is user authenticated?
            ├─ NO → Redirect to /login
            │
            └─ YES ↓
            
            User Department exists?
            ├─ NO → Default to 'buying'
            │
            └─ YES ↓
            
            Get allowed departments
            for this route
            (e.g., ['buying', 'admin'])
                    │
                    ↓
        Is user.department in allowed array?
        ├─ YES → ✅ Render Page
        │         Page content shows
        │         with sidebar + data
        │
        └─ NO → ❌ Access Denied
                  Error message shows
                  explaining restriction
```

---

## 📊 Component Hierarchy

```
                        <App>
                         │
                    <Router>
                         │
                   <AuthProvider>
                         │
                    <Routes>
                         │
        ┌────────────────┴────────────────┐
        │                                 │
   [Login Route]              [Protected Routes]
        │                             │
   <LoginPage>          <ProtectedRoute>
                               │
                        <DepartmentLayout>
                               │
                    ┌──────────┴──────────┐
                    │                     │
                [Sidebar]           [Main Content]
                    │                     │
            - Menu Items          <DepartmentProtectedRoute>
            - User Info                   │
            - Department Badge     [Page Component]
            - Logout              - Buying modules
            - Theme Toggle        - Selling modules
                                  - Masters
                                  - Analytics
```

---

## 🔗 Data Flow - Login to Dashboard

```
1. USER LOGIN
   ├─ Enter email/password
   └─ Select department

                  ↓

2. BACKEND VALIDATION
   ├─ Email/password check ✓
   ├─ Create JWT with department
   └─ Return token + user data

                  ↓

3. FRONTEND STORES DATA
   ├─ localStorage: token, user
   ├─ localStorage: user.department
   └─ AuthContext: user, department

                  ↓

4. REDIRECT TO DASHBOARD
   └─ Navigate to /dashboard

                  ↓

5. ROUTE PROCESSING
   ├─ ProtectedRoute: Checks token ✓
   ├─ DepartmentLayout: Reads user.department
   ├─ Filters menu items based on department
   └─ Shows department badge + color

                  ↓

6. DASHBOARD RENDERS
   ├─ DepartmentDashboard reads user.department
   ├─ Shows appropriate dashboard layout
   └─ User sees department-specific cards

                  ↓

7. NAVIGATION
   └─ User can click sidebar items
      (Only their department's items visible)
```

---

## 🎨 Department Color Scheme

```
┌──────────────────────────────────────────────────────┐
│              DEPARTMENT COLOR MAPPING                │
├──────────────────────────────────────────────────────┤
│                                                       │
│  🔵 BUYING/PROCUREMENT                               │
│     Color: Indigo (#4F46E5)                          │
│     Used in:                                         │
│     ├─ User avatar background                        │
│     ├─ Department badge                              │
│     ├─ Dashboard header                              │
│     ├─ Stat card backgrounds                         │
│     └─ Icon highlights                               │
│                                                       │
│  🟣 SELLING/SALES                                    │
│     Color: Purple (#7C3AED)                          │
│     Used in:                                         │
│     ├─ User avatar background                        │
│     ├─ Department badge                              │
│     ├─ Dashboard header                              │
│     ├─ Stat card backgrounds                         │
│     └─ Icon highlights                               │
│                                                       │
│  🔴 ADMINISTRATION                                   │
│     Color: Red (#DC2626)                             │
│     Used in:                                         │
│     ├─ User avatar background                        │
│     ├─ Department badge                              │
│     ├─ Dashboard header                              │
│     ├─ Stat card backgrounds                         │
│     └─ Icon highlights                               │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 🧩 File Dependencies

```
App.jsx
├─ imports: DepartmentLayout
├─ imports: DepartmentProtectedRoute
├─ imports: ProtectedRoute
├─ imports: LoginPage
└─ imports: All page components
   │
   ├─ DepartmentLayout.jsx
   │  ├─ imports: useAuth (AuthContext)
   │  ├─ imports: Sidebar.css
   │  └─ returns: Layout + Filtered Sidebar
   │
   ├─ DepartmentProtectedRoute.jsx
   │  ├─ imports: useAuth (AuthContext)
   │  └─ returns: Content or Access Denied
   │
   ├─ ProtectedRoute.jsx
   │  ├─ imports: useAuth (AuthContext)
   │  └─ returns: Content or Redirect
   │
   └─ Page Components
      ├─ DepartmentDashboard.jsx
      ├─ MaterialRequests.jsx
      ├─ Quotation.jsx
      └─ etc.

AuthContext (Global)
├─ Stores: user, department, token
├─ Methods: login, register, logout
└─ Used by: ProtectedRoute, DepartmentLayout, DepartmentProtectedRoute

Database
└─ users table
   ├─ id
   ├─ email
   ├─ password (hashed)
   ├─ full_name
   └─ department ← NEW COLUMN
```

---

## 🔄 Request Lifecycle

```
USER REQUEST FLOW
═══════════════════════════════════════════════════════

1️⃣ Navigation Event
   └─ User clicks sidebar link or types URL

2️⃣ Route Matching
   └─ React Router matches URL to route

3️⃣ Component Tree Build
   ├─ <ProtectedRoute> (Authentication layer)
   │  ├─ Check: Is token valid?
   │  ├─ NO  → <Redirect to /login>
   │  └─ YES → Continue
   │
   ├─ <DepartmentLayout> (Navigation layer)
   │  ├─ Read: user.department
   │  ├─ Filter: Menu items based on department
   │  └─ Render: Sidebar + Main area
   │
   ├─ <DepartmentProtectedRoute> (Access layer)
   │  ├─ Check: Is department in allowed list?
   │  ├─ NO  → <AccessDenied>
   │  └─ YES → Continue
   │
   └─ <PageComponent>
      └─ Render: Actual page content

4️⃣ User Sees
   ├─ If allowed:  Sidebar + Page content ✅
   └─ If denied:   Sidebar + Access Denied message ❌
```

---

## 📱 Responsive Layout

```
DESKTOP (> 768px)
┌──────────┬────────────────────────┐
│ Sidebar  │    Main Content        │
│ (Open)   │                        │
│          │                        │
│ 256px    │    Fill Remaining      │
│          │                        │
│ - Menu   │    [Page/Component]    │
│ - Icons  │                        │
│          │                        │
└──────────┴────────────────────────┘

TABLET (≤ 768px)
┌─────────────────────────────────┐
│ Menu (Collapsed) │ Main Content  │
│     Toggle       │               │
│  [=] [Content]   │               │
└─────────────────────────────────┘

MOBILE (< 640px) with Sidebar Closed
┌──────────────────────────────┐
│ [≡] Header                   │
├──────────────────────────────┤
│                              │
│     Main Content             │
│                              │
│   [Full Width]               │
│                              │
└──────────────────────────────┘

MOBILE (< 640px) with Sidebar Open
┌──────────────────────────────┐
│ Sidebar Overlay              │
│ [Menu Items]                 │
│ [Close/Outside click]        │
│                              │
│ [Dimmed Background]          │
└──────────────────────────────┘
```

---

## ✅ Security Layers

```
LAYER 1: Authentication
┌─────────────────────┐
│ ProtectedRoute      │
├─────────────────────┤
│ • Check token       │
│ • Verify JWT        │
│ • Redirect if null  │
└─────────────────────┘
         │
         ↓ Token valid
         
LAYER 2: Navigation
┌─────────────────────┐
│ DepartmentLayout    │
├─────────────────────┤
│ • Read dept from    │
│   authenticated     │
│   user object       │
│ • Filter menu       │
│ • Hide irrelevant   │
│   menu items        │
└─────────────────────┘
         │
         ↓ User sees filtered menu
         
LAYER 3: Access Control
┌─────────────────────┐
│ DepartmentProtected │
│ Route              │
├─────────────────────┤
│ • Check dept        │
│   against route     │
│   requirements      │
│ • Block access if   │
│   not allowed       │
│ • Show error if     │
│   denied            │
└─────────────────────┘
         │
         ↓ Access validated
         
RESULT: Safe, Secure Access ✅
```

---

## 🎯 Key Design Decisions

### 1. **Wrapper Pattern**
- Components wrap around each other
- Each layer handles one responsibility
- Separation of concerns

### 2. **Department-First Design**
- Department determines access
- No complex permission system needed
- Clear and easy to understand

### 3. **Visual Feedback**
- Color coding for quick recognition
- Badge shows current department
- Prevents confusion

### 4. **Graceful Degradation**
- If department missing → defaults to 'buying'
- If auth fails → redirects to login
- If access denied → shows message (doesn't crash)

### 5. **Flexible Access Control**
- Route-level restrictions
- Departments array per route
- Admin has universal access

---

## 📈 Scalability

### Adding New Departments
```
1. Update database (add enum value)
2. Update LoginPage.jsx (add option)
3. Update DepartmentDashboard.jsx (add case)
4. Update DepartmentLayout.jsx (add condition)
5. Add menu items for new department
6. Add routes with new department restriction
```

### Adding New Pages
```
1. Create page component
2. Add route in App.jsx
3. Wrap with DepartmentProtectedRoute
4. Add menu item in DepartmentLayout.jsx
5. Done!
```

---

**Architecture Complete** ✅  
**All Components Integrated** ✅  
**Ready for Production** ✅