# Pagination & Filters - Quick Reference Guide

## 🎯 Quick Start

### **Every Inventory Page Now Has:**
1. **Search Box** - Search by item/name/code/ID
2. **Filter Dropdowns** - Filter by status, warehouse, type, etc.
3. **Clear Filters Button** - Reset all filters at once
4. **Pagination Controls** - Navigate pages and set items per page

---

## 📊 Page-by-Page Quick Guide

### **1. Warehouses** 🏢
```
Search: By warehouse name, location, or manager
Filter: All Locations OR specific location
Shows: 10 warehouses per page (configurable)
```

### **2. Stock Balance** 📦
```
Search: By item code or item name
Filter 1: All Warehouses OR specific warehouse
Filter 2: All Status / In Stock / Low Stock / Out of Stock
Shows: 10 items per page
```

### **3. Stock Entries** 📝
```
Search: By entry ID or warehouse name
Filter 1: All Types / Purchase Receipt / Production / Adjustment
Filter 2: All Warehouses OR specific warehouse
Shows: 10 entries per page
```

### **4. Stock Ledger** 📖
```
Filter 1: All Warehouses OR specific warehouse
Filter 2: All Items OR specific item
Filter 3: From Date (date picker)
Filter 4: To Date (date picker)
Extra: Clear all filters button
Shows: 10 entries per page
```

### **5. Stock Transfers** 🚚
```
Search: By transfer ID or warehouse names
Filter: All Status / Draft / Submitted / In Transit / Received / Cancelled
Shows: 10 transfers per page
```

### **6. Batch Tracking** 🏷️
```
Search: By batch number, item code, or item name
Filter: All Status / Active / Expiring Soon / Expired / Exhausted
Shows: 10 batches per page
```

### **7. Reconciliation** ⚖️
```
Search: By reconciliation ID or warehouse name
Filter: All Status / Draft / Submitted
Shows: 10 reconciliations per page
```

### **8. Reorder Management** ⚠️
```
Search: By item code, item name, or warehouse name
Filter: All Status / Active / Inactive
Shows: 10 settings per page
```

---

## 🔍 How to Use Filters

### **Step 1: Open a Page**
```
Click on any inventory page from sidebar
→ Table loads with filters visible
```

### **Step 2: Search**
```
Type in search box
→ Table filters instantly as you type
→ Shows only matching records
```

### **Step 3: Apply Additional Filters**
```
Click on dropdown filters
→ Select specific filter value
→ Table updates immediately
→ Pagination resets to page 1
```

### **Step 4: Combine Filters**
```
You can combine multiple filters:
- Search term + Dropdown filter 1 + Dropdown filter 2
→ Shows only records matching ALL active filters
```

### **Step 5: Clear All Filters**
```
Click "Clear Filters" button (or X icon)
→ All filters reset to defaults
→ Shows all records again
→ Pagination resets to page 1
```

---

## 📄 How to Use Pagination

### **Change Items Per Page:**
```
Look for dropdown in pagination controls
Default: "10 items per page"
Options: 10, 25, 50, 100 items per page
→ Click to change
→ Table reloads with new page size
```

### **Navigate Pages:**
```
Use page number buttons: 1 2 3 ... 10
Or use:
- ← Previous (go back one page)
- Next → (go forward one page)
Current page is highlighted
```

### **View Current Position:**
```
Pagination shows: "Showing X to Y of Z items"
Example: "Showing 21 to 30 of 150 items"
```

---

## 💡 Tips & Tricks

### **Tip 1: Search is Always Available**
- Search filters instantly as you type
- No need to press Enter
- Case-insensitive (uppercase/lowercase both work)

### **Tip 2: Combine Filters for Precision**
```
Example: Find "low stock items in Mumbai warehouse"
1. Type "low" in search (optional)
2. Select "Low Stock" from status filter
3. Select "Mumbai" from location filter
→ Shows only matching items
```

### **Tip 3: Use Date Filters for Time Ranges**
```
Stock Ledger example:
1. Select "From Date" = Jan 1, 2024
2. Select "To Date" = Jan 31, 2024
→ Shows only January transactions
```

### **Tip 4: Switch Items Per Page for Overview/Detail**
```
Need quick overview? → Select "100 items per page"
Need focused view? → Select "10 items per page"
```

### **Tip 5: Clear Filters for Fresh Start**
```
Filter got complex?
1. Click "Clear Filters"
2. All filters reset
3. See all records again
```

---

## 🎨 Visual Guide

### **Filter Bar Layout:**
```
[Search Box......] [Dropdown 1] [Dropdown 2] [Clear Filters ✕]
```

### **Empty State Messages:**
```
LOADING STATE:
  🔄 Loading items...

NO DATA STATE:
  📦 No items found.
  Create your first item to get started.

NO MATCHES STATE:
  ❌ No items match your filters.
  Try adjusting your search or filters.
```

### **Pagination Layout:**
```
Showing 11 to 20 of 150 items    [Items per page: 10 ▼]
  ← 1 2 3 4 5 6 ... 15 →
```

---

## ⚡ Keyboard Shortcuts (Future)

Currently available:
- Tab: Navigate between filter fields
- Enter: Apply filter/search
- Shift+Tab: Navigate backwards

---

## 🔧 Troubleshooting

### **Q: Filter not working?**
**A:**
- Check spelling in search box
- Make sure dropdown is set to desired value
- Try "Clear Filters" and start over

### **Q: Only seeing 1 page?**
**A:**
- You have ≤ 10 items (or your selected items per page)
- This is normal! Pagination appears when needed
- Try increasing "items per page" option

### **Q: Pagination disappeared after filtering?**
**A:**
- Your filter criteria matched all records on one page
- This is correct behavior
- Add more specific filters to see pagination again

### **Q: Search not finding what I'm looking for?**
**A:**
- Search is case-insensitive (spaces are included)
- Try partial match (e.g., search "item" instead of "ITEM001")
- Check spelling carefully
- Use dropdown filters for more precise filtering

### **Q: How do I go back to page 1?**
**A:**
- Click page number "1" in pagination
- Or modify any filter (auto-resets to page 1)
- Or click "Clear Filters" button

---

## 📱 Mobile Usage

### **On Mobile Devices:**
- Filters stack vertically
- Search box is full width
- Dropdown filters show as select elements
- Pagination controls wrap to multiple lines
- "Clear Filters" button is available below dropdowns
- Everything is touch-friendly

---

## 🎯 Common Use Cases

### **Use Case 1: Find Low Stock Items**
```
1. Go to Stock Balance
2. Change status filter to "Low Stock"
3. See all items needing reorder
4. Change to 50 items per page for overview
```

### **Use Case 2: Track Transfers by Date**
```
1. Go to Stock Ledger  
2. Set From Date = Start of month
3. Set To Date = End of month
4. See monthly transactions
```

### **Use Case 3: Check Expiring Batches**
```
1. Go to Batch Tracking
2. Filter by "Expiring Soon"
3. See batches expiring within 30 days
4. Plan usage accordingly
```

### **Use Case 4: Audit Warehouse Inventory**
```
1. Go to Stock Balance
2. Filter by specific warehouse
3. Sort through all items
4. Check quantities and status
```

### **Use Case 5: Monitor Draft Transfers**
```
1. Go to Stock Transfers
2. Filter by "Draft" status
3. See pending transfers
4. Edit or delete as needed
```

---

## ✅ Best Practices

✅ **Use Search for Quick Lookups**
- Fast way to find specific items
- Works across multiple fields

✅ **Use Dropdowns for Category Filtering**
- Great for filtering by status, warehouse, type
- More accurate than partial search

✅ **Combine Filters for Precision**
- Search + Dropdown = Most precise results

✅ **Clear Filters When Lost**
- Always an option to reset everything
- Can start fresh any time

✅ **Adjust Items Per Page**
- Use for printing or exporting data
- Helps with performance on slower devices

---

## 🎉 Features Summary

| Feature | Availability | Benefit |
|---------|--------------|---------|
| Search Filters | All pages | Quick item lookup |
| Status Filters | All pages | Category filtering |
| Additional Filters | Most pages | Precise data slicing |
| Pagination | All pages | Manage large datasets |
| Clear Filters | All pages | Quick reset option |
| Mobile Responsive | All pages | Works on all devices |
| Dark Mode | All pages | Eye-friendly view |
| Instant Search | All pages | Real-time filtering |

---

## 📞 Need Help?

Each page has:
- **Icon** - Visual indication of what page you're on
- **Title** - Clear page name
- **Loading State** - Shows when fetching data
- **Empty States** - Helpful messages when no data
- **Tooltips** - Hover for field descriptions

---

**Ready to use!** Start exploring your inventory data with filters and pagination! 🚀
