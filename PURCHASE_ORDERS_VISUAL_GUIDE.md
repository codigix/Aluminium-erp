# Purchase Orders Page - Visual Layout Guide 📐

## Complete Page Layout

```
╔════════════════════════════════════════════════════════════════════════════╗
║                            PURCHASE ORDERS PAGE                            ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─ HEADER SECTION ────────────────────────────────────────────────────────────┐
│                                                                              │
│  Purchase Orders                                      [+ Create New PO]      │
│  Manage and track all procurement activities                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ ERROR ALERT (if error exists) ─────────────────────────────────────────────┐
│  🔴 Error message displays here in red card                                 │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ STATS DASHBOARD ───────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐
│  │      📦         │ │      📝         │ │      🔄         │ │      ✅      │
│  │  TOTAL POS      │ │    DRAFT        │ │  IN PROGRESS    │ │  COMPLETED  │
│  │      12         │ │      3          │ │      5          │ │      4      │
│  │ ₹5.2L total     │ │                 │ │                 │ │             │
│  │ value           │ │                 │ │                 │ │             │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘
│    (clickable)        (clickable)        (not clickable)      (clickable)
│
└──────────────────────────────────────────────────────────────────────────────┘


┌─ ADDITIONAL STATUS CARDS (if applicable) ──────────────────────────────────┐
│                                                                              │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│  │        📥            │ │         ⚠️           │ │         ❌           │ │
│  │   TO RECEIVE         │ │  PARTIALLY RECEIVED  │ │     CANCELLED        │ │
│  │        2             │ │         1            │ │         0            │ │
│  └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│                                                                              │
│  (Only shows if that status has data)                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ FILTERS SECTION ───────────────────────────────────────────────────────────┐
│                                                                              │
│  [Search PO ░░░░░] [Status ▼] [Supplier ░░░░░] [Apply] [Reset]            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


┌─ DATA TABLE ────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌────┬──────────┬─────────┬──────────┬──────────────┬─────────┬────────────┤
│  │ # │ PO Num   │Supplier │Order     │Expected      │ Amount  │Status      │
│  │   │          │         │Date      │Delivery      │         │            │
│  ├────┼──────────┼─────────┼──────────┼──────────────┼─────────┼────────────┤
│  │ 1 │ PO-0001  │ ABC Inc │01 Jan 24 │ 03 Jan 24    │ ₹10,000 │📝 DRAFT   │
│  │   │          │         │          │ 🟢 2 days    │         │            │
│  │   │          │         │          │    left      │         │            │
│  ├────┼──────────┼─────────┼──────────┼──────────────┼─────────┼────────────┤
│  │ 2 │ PO-0002  │ XYZ Ltd │02 Jan 24 │ 04 Jan 24    │ ₹15,000 │📥 TO REC  │
│  │   │          │         │          │ 🟡 1 day     │         │            │
│  │   │          │         │          │    left      │         │            │
│  ├────┼──────────┼─────────┼──────────┼──────────────┼─────────┼────────────┤
│  │ 3 │ PO-0003  │ Best Co │03 Jan 24 │ 01 Jan 24    │ ₹8,500  │⚠️ PARTIAL │
│  │   │          │         │          │ 🔴 2 days    │         │            │
│  │   │          │         │          │    overdue   │         │            │
│  ├────┼──────────┼─────────┼──────────┼──────────────┼─────────┼────────────┤
│  │ 4 │ PO-0004  │ QRS Inc │04 Jan 24 │ 05 Jan 24    │ ₹12,000 │✅ DONE    │
│  │   │          │         │          │ 05 Jan 24    │         │            │
│  └────┴──────────┴─────────┴──────────┴──────────────┴─────────┴────────────┘
│
│  Showing 4 of 12 records  [< Page 1 of 2 >]
│
└──────────────────────────────────────────────────────────────────────────────┘


┌─ ACTIONS COLUMN (part of table) ────────────────────────────────────────────┐
│                                                                              │
│  Row 1 (Draft):          │ 📖 View │ ✏️ Edit │ ✉️ Submit │                │
│  Row 2 (To Receive):     │ 📖 View │ 📥 Receive         │                │
│  Row 3 (Partial):        │ 📖 View │ 📥 Receive         │                │
│  Row 4 (Completed):      │ 📖 View                      │                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Empty State

```
╔════════════════════════════════════════════════════════════════════════════╗
║                            PURCHASE ORDERS PAGE                            ║
╚════════════════════════════════════════════════════════════════════════════╝

                            (No stats shown)

                    [Filters section]


                        ┌────────────────────┐
                        │        📋          │
                        │                    │
                        │  No purchase       │
                        │  orders found      │
                        │                    │
                        │ Get started by     │
                        │ creating your      │
                        │ first purchase     │
                        │ order              │
                        │                    │
                        │ [Create First PO]  │
                        └────────────────────┘
```

---

## Loading State

```
╔════════════════════════════════════════════════════════════════════════════╗
║                            PURCHASE ORDERS PAGE                            ║
╚════════════════════════════════════════════════════════════════════════════╝

                            (No stats shown)

                    [Filters section]


                            ┌──────────┐
                            │   ⏳     │
                            │ (spinner)│
                            │          │
                            │ Loading  │
                            │purchase  │
                            │orders... │
                            └──────────┘
```

---

## Error State

```
╔════════════════════════════════════════════════════════════════════════════╗
║                            PURCHASE ORDERS PAGE                            ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─ ERROR ALERT ───────────────────────────────────────────────────────────────┐
│  ⚠️ Error fetching purchase orders                                          │
└──────────────────────────────────────────────────────────────────────────────┘

                            (No stats shown)

                    [Filters section]

                            (Empty table)
```

---

## Stat Card Details

### Primary Stat Card (Total)
```
┌─────────────────────────────┐
│         📦                  │
│  TOTAL POS                  │
│  12                         │
│  ₹5.2L total value          │
│                             │
│ Border: primary-200         │
│ Background: primary-50      │
│ (Hover: shadow effect)      │
│ (Click: filter by none)     │
└─────────────────────────────┘
```

### Warning Stat Card (Draft)
```
┌─────────────────────────────┐
│         📝                  │
│  DRAFT                      │
│  3                          │
│                             │
│ Border: yellow-200          │
│ Background: yellow-50       │
│ (Hover: shadow effect)      │
│ (Click: filter by draft)    │
└─────────────────────────────┘
```

### Success Stat Card (Completed)
```
┌─────────────────────────────┐
│         ✅                  │
│  COMPLETED                  │
│  4                          │
│                             │
│ Border: green-200           │
│ Background: green-50        │
│ (Hover: shadow effect)      │
│ (Click: filter by completed)│
└─────────────────────────────┘
```

---

## Delivery Date Indicator States

### Safe (>3 days)
```
┌───────────────────────────┐
│ 2024-01-15                │
│ 🟢 3 days left            │
└───────────────────────────┘
Color: text-green-600
Icon: 🟢 (green circle)
```

### Urgent (0-3 days)
```
┌───────────────────────────┐
│ 2024-01-12                │
│ 🟡 2 days left            │
└───────────────────────────┘
Color: text-orange-600
Icon: 🟡 (yellow circle)
```

### Overdue (<0 days)
```
┌───────────────────────────┐
│ 2024-01-10                │
│ 🔴 1 day overdue          │
└───────────────────────────┘
Color: text-red-600
Icon: 🔴 (red circle)
```

---

## Responsive Layouts

### Mobile (< 768px)
```
╔═══════════════════════════╗
║  Purchase Orders          ║
║  Manage and track...      ║
║     [+ Create]            ║
╠═══════════════════════════╣
║ ┌──────────────────────┐  ║
║ │      📦              │  ║
║ │  TOTAL POS           │  ║
║ │  12                  │  ║
║ └──────────────────────┘  ║
║ ┌──────────────────────┐  ║
║ │      📝              │  ║
║ │  DRAFT               │  ║
║ │  3                   │  ║
║ └──────────────────────┘  ║
║ ┌──────────────────────┐  ║
║ │      🔄              │  ║
║ │  IN PROGRESS         │  ║
║ │  5                   │  ║
║ └──────────────────────┘  ║
║ ┌──────────────────────┐  ║
║ │      ✅              │  ║
║ │  COMPLETED           │  ║
║ │  4                   │  ║
║ └──────────────────────┘  ║
║                           ║
║ [Filters]                 ║
║                           ║
║ [Table - horizontal scroll]
╚═══════════════════════════╝
```

### Tablet (768px - 1024px)
```
╔════════════════════════════════════════╗
║  Purchase Orders   [+ Create New PO]   ║
║  Manage and track all procurement...   ║
╠════════════════════════════════════════╣
║ ┌─────────────┐ ┌─────────────┐       ║
║ │     📦      │ │      📝     │       ║
║ │ TOTAL POS   │ │   DRAFT     │       ║
║ │     12      │ │      3      │       ║
║ └─────────────┘ └─────────────┘       ║
║ ┌─────────────┐ ┌─────────────┐       ║
║ │     🔄      │ │      ✅     │       ║
║ │ IN PROGRESS │ │  COMPLETED  │       ║
║ │      5      │ │      4      │       ║
║ └─────────────┘ └─────────────┘       ║
║                                        ║
║ [Filters]                              ║
║ [Table]                                ║
╚════════════════════════════════════════╝
```

### Desktop (> 1024px)
```
╔════════════════════════════════════════════════════════════════════════════╗
║  Purchase Orders                                    [+ Create New PO]       ║
║  Manage and track all procurement activities                               ║
╠════════════════════════════════════════════════════════════════════════════╣
║ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      ║
║ │      📦      │ │      📝      │ │      🔄      │ │      ✅      │      ║
║ │  TOTAL POS   │ │   DRAFT      │ │ IN PROGRESS  │ │  COMPLETED   │      ║
║ │      12      │ │      3       │ │      5       │ │      4       │      ║
║ │ ₹5.2L total  │ │              │ │              │ │              │      ║
║ │  value       │ │              │ │              │ │              │      ║
║ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      ║
║                                                                            ║
║ [Filters]                                                                  ║
║ [Full Width Table with all columns]                                        ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## Dark Mode Appearance

### Light Mode
```
Background: White
Header Text: Dark Gray
Stat Cards: Light backgrounds with colored borders
Table: Light rows with alternating backgrounds
```

### Dark Mode
```
Background: Dark Gray (#1F2937)
Header Text: White (#F9FAFB)
Stat Cards: Dark backgrounds with colored borders
Table: Dark rows with subtle alternation
Icon Colors: Bright and visible
Text: High contrast white/light gray
```

---

## Interactive Elements Behavior

### Stat Card Hover
```
Before Hover:
┌───────────┐
│ Total: 12 │
└───────────┘

After Hover:
┌───────────┐
│ Total: 12 │  ← Shadow appears
└───────────┘    Cursor changes to pointer
     ↓ Click
Filter applied (if applicable)
```

### Action Button Behavior
```
View Button:
- Always visible
- Click → Navigate to PO detail view
- Blue color (primary)

Edit Button:
- Visible only when status === 'draft'
- Click → Navigate to edit mode
- Green color (success)

Submit Button:
- Visible only when status === 'draft'
- Click → Submit PO (WIP)
- Blue color (info)

Receive Button:
- Visible when status in ['submitted', 'to_receive', 'partially_received']
- Click → Create purchase receipt
- Blue color (info)
```

---

## Color Coding System

### Status Colors
| Status | Badge Color | Icon | Meaning |
|--------|------------|------|---------|
| Draft | Yellow | 📝 | Editable |
| Submitted | Blue | ✉️ | Sent |
| To Receive | Blue | 📥 | Waiting |
| Partially Received | Yellow | ⚠️ | Partial |
| Completed | Green | ✅ | Done |
| Cancelled | Red | ❌ | Void |

### Delivery Status Colors
| Status | Color | Icon | Days |
|--------|-------|------|------|
| Safe | Green | 🟢 | > 3 |
| Urgent | Orange | 🟡 | 0-3 |
| Overdue | Red | 🔴 | < 0 |

---

## Grid System

### Stats Dashboard Grid
```
Desktop (1024+px):    4 columns
                      gap-4

Tablet (768-1024px):  2 columns
                      gap-4

Mobile (<768px):      1 column
                      gap-4

Additional Row:       3 columns (desktop)
                      2 columns (tablet)
                      1 column (mobile)
```

---

## Spacing Reference

```
Page Padding:     1.5rem (24px)
Section Margin:   mb-6 to mb-8
Card Padding:     p-4
Grid Gap:         gap-4
Button Gap:       gap-6px
```

---

## Typography Reference

```
Page Title:       text-3xl font-bold
Subtitle:         text-base text-neutral-600
Stat Value:       text-2xl font-bold
Stat Label:       text-xs font-medium uppercase
Table Header:     font-medium
Table Cell:       font-normal
Loading Text:     text-neutral-600 font-medium
Error Text:       text-red-700 dark:text-red-400
```

---

**Status:** ✅ Design Complete
**Responsive:** ✅ Mobile to Desktop
**Dark Mode:** ✅ Fully Supported
**Accessibility:** ✅ Semantic HTML