# Department Dashboards - Visual Guide

## 📱 Registration Form with Department Selection

### Before (Old)
```
┌─────────────────────────────────┐
│  Aluminium ERP - Registration   │
├─────────────────────────────────┤
│                                 │
│  Full Name: [_____________]     │
│  Email: [_______________]       │
│  Password: [_____________]      │
│  Confirm: [_____________]       │
│                                 │
│  [Register] button              │
└─────────────────────────────────┘
```

### After (New)
```
┌─────────────────────────────────┐
│  Aluminium ERP - Registration   │
├─────────────────────────────────┤
│                                 │
│  Full Name: [_____________]     │
│                                 │
│  Department: [select dropdown]  │
│  ┌─────────┬────────┬────────┐  │
│  │🔵 Buying│🟣Selling│🔴Admin │ │
│  │Procure- │  Sales   │      │ │
│  │ment     │          │      │ │
│  └─────────┴────────┴────────┘  │
│                                 │
│  Email: [_______________]       │
│  Password: [_____________]      │
│  Confirm: [_____________]       │
│                                 │
│  [Register] button              │
└─────────────────────────────────┘
```

---

## 🎨 Department Colors & Badges

### Visual Identification

```
🔵 BUYING DEPARTMENT
   Color: #4F46E5 (Indigo/Blue)
   Icon: 📦
   Badge: [🔵 Buying Department]
   
🟣 SELLING DEPARTMENT
   Color: #7C3AED (Purple)
   Icon: 📈
   Badge: [🟣 Selling Department]
   
🔴 ADMIN DEPARTMENT
   Color: #DC2626 (Red)
   Icon: ⚙️
   Badge: [🔴 Admin Department]
```

---

## 📊 BUYING DEPARTMENT DASHBOARD

### Layout
```
┌──────────────────────────────────────────────────────┐
│ Aluminium ERP                    [🔵 Buying Module]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Welcome to Buying Module, John! 👋                 │
│ Manage your procurement operations with ease        │
│                                                      │
├──────────────────────────────────────────────────────┤
│ STATISTICS CARDS (6 columns on desktop)              │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │📄 Material  │ │📤 RFQs      │ │💰 Quotations│   │
│ │ Requests    │ │            │ │             │    │
│ │    45       │ │    12       │ │     28      │    │
│ │ Total MRs   │ │ Active RFQs │ │ Supplier Q. │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │🏢 Suppliers │ │📋 POs       │ │🧾 Invoices  │   │
│ │             │ │            │ │             │    │
│ │    15       │ │    32       │ │     48      │    │
│ │ Active Supp.│ │ Total POs   │ │ Invoices    │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
├──────────────────────────────────────────────────────┤
│ QUICK ACTIONS                                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│ [➕ Create Material Request] [📤 Create RFQ]        │
│ [➕ Add Quotation]           [📄 View All Requests]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Key Features
- 🔵 Blue color scheme throughout
- 6 stat cards with Buying-specific metrics
- Quick actions for procurement operations
- Links to: Material Requests, RFQs, Quotations, Suppliers, POs, Invoices

### Quick Actions Available
```
✓ Create Material Request  → /buying/material-requests/new
✓ Create RFQ             → /buying/rfqs/new
✓ Add Quotation          → /buying/quotations/new
✓ View All Requests      → /buying/material-requests
```

---

## 📊 SELLING DEPARTMENT DASHBOARD

### Layout
```
┌──────────────────────────────────────────────────────┐
│ Aluminium ERP                    [🟣 Selling Module] │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Welcome to Selling Module, Jane! 📈                │
│ Manage your sales pipeline and customer relations  │
│                                                      │
├──────────────────────────────────────────────────────┤
│ STATISTICS CARDS (6 columns on desktop)              │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │💰 Quotations│ │🛒 Sales     │ │🚚 Deliveries│   │
│ │             │ │ Orders      │ │             │    │
│ │    12       │ │    8        │ │     15      │    │
│ │ Active      │ │ Pending     │ │ Notes       │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │🧾 Invoices  │ │👥 Customers │ │📈 Sales    │   │
│ │             │ │            │ │             │    │
│ │    20       │ │    45       │ │    ₹9.5L    │   │
│ │ Invoices    │ │ Customers   │ │ This Month  │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
├──────────────────────────────────────────────────────┤
│ QUICK ACTIONS                                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│ [➕ Create Quotation]    [🛒 Create Sales Order]    │
│ [👥 Add Customer]        [💰 View All Quotations]   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Key Features
- 🟣 Purple color scheme throughout
- 6 stat cards with Sales-specific metrics
- Quick actions for sales operations
- Links to: Quotations, Sales Orders, Deliveries, Invoices, Customers, Analytics

### Quick Actions Available
```
✓ Create Quotation      → /selling/quotations/new
✓ Create Sales Order    → /selling/sales-orders/new
✓ Add Customer          → /selling/customers/new
✓ View All Quotations   → /selling/quotations
```

---

## 📊 ADMIN DEPARTMENT DASHBOARD

### Layout
```
┌──────────────────────────────────────────────────────┐
│ Aluminium ERP                    [🔴 Admin Panel]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Welcome to Admin Panel, Admin! ⚙️                   │
│ System administration and user management            │
│                                                      │
├──────────────────────────────────────────────────────┤
│ STATISTICS CARDS (4 columns on desktop)              │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │👥 Total     │ │🏢 Active    │ │🏥 System    │   │
│ │ Users       │ │ Departments │ │ Health      │    │
│ │    25       │ │    3        │ │    98%      │   │
│ │ Active/Inact│ │ Departments │ │ All OK      │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│                                                      │
│ ┌─────────────┐                                      │
│ │💾 Last      │                                      │
│ │ Backup      │                                      │
│ │   Today     │                                      │
│ │ 3:45 PM     │                                      │
│ └─────────────┘                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ ADMIN ACTIONS                                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│ [👥 Manage Users]      [🏢 Manage Departments]      │
│ [⚙️ System Settings]     [📊 View Reports]           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Key Features
- 🔴 Red color scheme throughout
- 4 stat cards with Admin-specific metrics
- Admin action buttons
- Links to: User Management, Department Management, System Settings, Reports

### Admin Actions Available
```
✓ Manage Users          → /admin/users (future)
✓ Manage Departments    → /admin/departments (future)
✓ System Settings       → /admin/system (future)
✓ View Reports          → /admin/reports (future)
```

---

## 📱 Responsive Design

### Desktop View (Full Width)
```
6 Stat Cards in 2 rows:
[Card] [Card] [Card]
[Card] [Card] [Card]
```

### Tablet View (Medium Width)
```
4 Stat Cards in 2 rows:
[Card] [Card]
[Card] [Card]
```

### Mobile View (Small Width)
```
Single column:
[Card]
[Card]
[Card]
[Card]
[Card]
[Card]

Buttons stack vertically:
[Button]
[Button]
[Button]
[Button]
```

---

## 🎨 Color Scheme Reference

### Buying (Indigo)
```
Primary: #4F46E5
Light Background: #4F46E515 (with transparency)
Hover: #4F46E5DD (with opacity)
Text: #4F46E5
```

### Selling (Purple)
```
Primary: #7C3AED
Light Background: #7C3AED15 (with transparency)
Hover: #7C3AED DD (with opacity)
Text: #7C3AED
```

### Admin (Red)
```
Primary: #DC2626
Light Background: #DC262615 (with transparency)
Hover: #DC2626DD (with opacity)
Text: #DC2626
```

---

## 🌙 Dark Mode Support

### Buying (Dark Mode)
```
Department Badge: Dark blue background, light text
Stat Cards: Dark background with indigo accents
Buttons: Indigo with dark background
```

### Selling (Dark Mode)
```
Department Badge: Dark purple background, light text
Stat Cards: Dark background with purple accents
Buttons: Purple with dark background
```

### Admin (Dark Mode)
```
Department Badge: Dark red background, light text
Stat Cards: Dark background with red accents
Buttons: Red with dark background
```

---

## 📈 Stat Card Layout

### Each Stat Card Contains

```
┌─────────────────────────┐
│ [ICON] TITLE            │
│                         │
│ 45                      │ ← Large Number (KPI)
│ Subtitle / Label        │ ← Description
└─────────────────────────┘
```

### Example: Material Requests Card
```
┌─────────────────────────┐
│ 📄 Material Requests    │
│                         │
│ 45                      │ ← Total Material Requests
│ Total MRs               │ ← Label
└─────────────────────────┘
```

---

## 🎯 Quick Actions Button Styles

### Buying Department
```
Primary (Create MR):      Indigo (#4F46E5)
Secondary (Create RFQ):   Indigo (#4F46E5)
Tertiary (Add Quote):     Indigo (#4F46E5)
Outline (View All):       Gray with Indigo text
```

### Selling Department
```
Primary (Create Quote):   Purple (#7C3AED)
Secondary (Create Order): Purple (#7C3AED)
Tertiary (Add Customer):  Purple (#7C3AED)
Outline (View All):       Gray with Purple text
```

### Admin Department
```
Primary (Manage Users):   Red (#DC2626)
Secondary (Departments):  Red (#DC2626)
Tertiary (Settings):      Red (#DC2626)
Outline (Reports):        Gray with Red text
```

---

## 🔄 Department Switch Experience

### Scenario: User Logs Out and Logs Back In

#### Session 1: Register as Buying
```
Registration → Buying Department selected → Login → Buying Dashboard (🔵)
```

#### Session 2: Same User Logs In
```
Login with same credentials → Buying Dashboard (🔵) appears automatically
Department remembered from database
```

#### Session 3: Different User (Selling)
```
Registration → Selling Department selected → Login → Selling Dashboard (🟣)
```

---

## 📊 Statistics at a Glance

### Buying Dashboard Shows:
| Metric | Example | Purpose |
|--------|---------|---------|
| Material Requests | 45 | Track procurement demands |
| RFQs | 12 | Track supplier inquiries |
| Quotations | 28 | Track supplier responses |
| Suppliers | 15 | Vendor count |
| Purchase Orders | 32 | Track purchases |
| Invoices | 48 | Track payments |

### Selling Dashboard Shows:
| Metric | Example | Purpose |
|--------|---------|---------|
| Quotations | 12 | Track sales quotes |
| Sales Orders | 8 | Track pending orders |
| Deliveries | 15 | Track shipments |
| Invoices | 20 | Track billings |
| Customers | 45 | Vendor count |
| Total Sales | ₹9.5L | Revenue tracking |

### Admin Dashboard Shows:
| Metric | Example | Purpose |
|--------|---------|---------|
| Total Users | 25 | User count |
| Departments | 3 | Department count |
| System Health | 98% | System status |
| Last Backup | Today 3:45 PM | Backup timestamp |

---

## 🎓 Visual Consistency Rules

1. **Color Consistency**
   - Each department has one primary color
   - Used consistently across all UI elements
   - Icons match color scheme

2. **Layout Consistency**
   - All dashboards follow same 6-card layout
   - Admin has 4 cards (fewer stats needed)
   - Same header format

3. **Button Consistency**
   - Same button sizes across all departments
   - Same icon + text format
   - Same hover/active states

4. **Typography Consistency**
   - Same font sizes for headers
   - Same font sizes for labels
   - Same font sizes for values

5. **Spacing Consistency**
   - Same padding between elements
   - Same margins between sections
   - Same gap between stat cards

---

**Visual Guide Complete!**

All dashboards follow the same professional design patterns while maintaining distinct visual identities through color coding and department-specific content.