# Sales Order Auto-Save Behavior - FIXED

## Issue Identified
Sales Orders were being automatically saved to the database without clicking the "Save" button, making it appear that the form auto-saves on every field change.

## Root Cause
**File**: `SalesOrderForm.jsx`  
**Lines 145-250** (Original)

### The Problem Code
```javascript
const handleInputChange = async (e) => {
  const { name, value } = e.target
  
  setFormData(prev => ({
    ...prev,
    [name]: value
  }))
  
  // ❌ CULPRIT: This calls autoSaveOrder on EVERY field change
  await autoSaveOrder(name, value)
}

const autoSaveOrder = async (fieldName, fieldValue) => {
  // 800ms debounce delay
  autoSaveTimeout.current = setTimeout(async () => {
    const updatedData = { ...formData, [fieldName]: fieldValue }
    
    // If all required fields filled → CREATE sales order
    if (updatedData.customer_id && updatedData.bom_id && updatedData.qty) {
      if (!id && !formData.sales_order_id) {
        const response = await productionService.createSalesOrder(payload)
        // Gets SO ID and saves to state immediately
      }
    }
  }, 800)
}
```

### Why This Was Wrong
1. **Every field change** triggers `autoSaveOrder()` 
2. After **800ms debounce**, API call fires to create/update SO
3. Frontend receives `sales_order_id` from backend
4. Record appears "auto-saved" in database
5. Users never explicitly clicked Save

### ERP Behavior Violation
Standard ERP workflow:
```
Open Form → Edit fields → Click SAVE → Database updated
                         ↑
                    Only now should DB change
```

---

## Solution Implemented

### Change 1: Remove Auto-Save from Field Changes
**Before**:
```javascript
const handleInputChange = async (e) => {
  setFormData(...)
  await autoSaveOrder(name, newValue)  // ❌ Auto-save called
}
```

**After**:
```javascript
const handleInputChange = (e) => {
  setFormData(...)
  // ✅ No auto-save call
}
```

### Change 2: Move Save Logic to handleSubmit
**Before**:
```javascript
const handleSubmit = (e) => {
  if (!formData.sales_order_id) {
    setError('Sales order ID not generated. Please fill...')
    return  // ❌ Just checks if SO exists
  }
  setSuccess('Saved')  // ❌ No actual save
}
```

**After**:
```javascript
const handleSubmit = async (e) => {
  e.preventDefault()
  
  if (!formData.customer_id || !formData.bom_id || !formData.qty) {
    setError('Please fill in all required fields')
    return
  }
  
  const payload = {
    customer_id: formData.customer_id,
    // ... all fields ...
  }
  
  if (formData.sales_order_id) {
    // ✅ UPDATE existing
    await productionService.updateSalesOrder(formData.sales_order_id, payload)
  } else {
    // ✅ CREATE new (only on explicit save)
    const response = await productionService.createSalesOrder(payload)
    if (response.data?.sales_order_id) {
      setFormData(prev => ({
        ...prev,
        sales_order_id: response.data.sales_order_id
      }))
    }
  }
  
  setSuccess('Sales Order saved successfully')
  navigate('/production/sales-orders')
}
```

### Change 3: Update UI Labels
**Before**:
```jsx
<label>Series {formData.sales_order_id && 
  <span>✓ Auto-created</span>
}</label>
<input placeholder="Auto-generated" />
```

**After**:
```jsx
<label>Series {formData.sales_order_id && 
  <span>✓ Generated on Save</span>
}</label>
<input placeholder="Generated when you save" />
```

### Change 4: Remove Unused State & Functions
**Removed**:
- `const [autoSaving, setAutoSaving] = useState(false)`
- `const autoSaveTimeout = useRef(null)`
- Entire `autoSaveOrder()` function (75 lines)
- Auto-save indicator UI (`⟳ Saving...`)

---

## Impact

### Before Fix
```
User opens form
  ↓
User changes Customer field
  ↓ (800ms delay)
  ↓
Auto-save fires → Sales Order created in DB
  ↓
SO ID appears in form
  ↓
User unaware of DB change
  ↓
Empty draft SO in database
```

### After Fix
```
User opens form
  ↓
User fills in Customer, BOM, Qty
  ↓
User clicks "SAVE" button
  ↓ (explicit action)
  ↓
handleSubmit() validates & saves
  ↓
Backend creates/updates SO
  ↓
SO ID returned and displayed
  ↓
User knows exactly when data is saved
```

---

## User Experience Changes

### What's Different Now
| Scenario | Before | After |
|----------|--------|-------|
| Fill customer field | Triggered auto-save | No save, just updates form |
| Fill BOM field | Triggered auto-save | No save, just updates form |
| Change quantity | Triggered auto-save | No save, just updates form |
| Click Save button | Did nothing (SO already saved) | **✅ Saves form to DB** |
| Multiple form opens | Multiple SO drafts | **✅ Single SO only when saved** |
| Field validation | None (auto-saved anything) | **✅ Validates required fields on Save** |

---

## Testing Checklist

- [ ] Open "New Sales Order" form
- [ ] Fill in Customer → no DB change
- [ ] Fill in BOM → no DB change  
- [ ] Fill in Quantity → no DB change
- [ ] Click Cancel → no SO created
- [ ] Fill all required fields
- [ ] Click Save button → SO created once
- [ ] Edit existing SO → still no auto-saves
- [ ] Click Save after edit → updates existing SO
- [ ] Confirm SO → transitions to confirmed status

---

## Code Changes Summary

| File | Method | Change |
|------|--------|--------|
| SalesOrderForm.jsx | handleInputChange() | Removed auto-save call |
| SalesOrderForm.jsx | handleSubmit() | Added explicit save logic |
| SalesOrderForm.jsx | (Component) | Removed autoSaving state |
| SalesOrderForm.jsx | (Component) | Removed autoSaveTimeout ref |
| SalesOrderForm.jsx | autoSaveOrder() | **REMOVED** (no longer needed) |
| SalesOrderForm.jsx | UI Labels | Updated to "Generated on Save" |

---

## Deployment Notes

✅ **No backend changes needed** - Frontend only fix  
✅ **Backward compatible** - Existing saved SOs unaffected  
✅ **No database migration** - Schema unchanged  

### Rebuild Frontend
```bash
cd frontend
npm run build  # Production build
# OR for development
npm run dev
```

---

## Result

**Sales Orders NOW:**
- ✅ Save only when user clicks Save button
- ✅ Don't auto-create on field changes
- ✅ Require all fields before saving
- ✅ Show clear "Generated on Save" status
- ✅ Follow standard ERP workflow

