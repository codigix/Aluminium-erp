# Implementation Plan: Generic Parent Assembly Materials Isolation

**Target Component:** `frontend/src/pages/ProductionPlan.jsx`  
**Scope:** UI / Frontend Data Filtering & Collection Logic Only (Strictly Zero Backend or Database Changes)  
**Rule:** 100% Dynamic — **No hardcoded drawing or BOM numbers**. Works universally for any Parent Assembly.

---

## 1. What is the Issue?

In the Production Plan creation workflow:
1. When a user selects an Assembly (Parent Assembly) and its BOM, the backend API `/production-plans/item-bom/:id` returns:
   - `materials`: A flattened list containing **both** direct Level-0 materials and **recursively exploded materials** from all intermediate parts/sub-assemblies (depth > 0).
   - `components`: A list of direct components attached to the Parent Assembly BOM, containing **both** manufactured parts (e.g. 32 Part items) and standard Bought-Out items (nuts, screws, washers, O-rings, hardware, etc.).
2. In `ProductionPlan.jsx`, the current `planDetails` logic:
   - Collects **all** materials from `item.materials` without filtering out child-level materials (`depth > 0` or materials whose `source_assembly` is a child part). This causes **16 raw materials belonging to the 32 Part items** to leak into the Materials section.
   - Collects components into the Materials section **only** if the item code starts with `CON-` (`code.startsWith('CON-')`). Direct Bought-Out items (with group `BOUGHT_OUT`, `BO-`, `Hardware`, etc.) are omitted from the Materials section.
3. **The Result:** The Materials section displays the wrong 16 child raw materials, while missing the direct materials and Bought-Out items belonging directly to the Parent Assembly BOM (which total 35 applicable items).

---

## 2. Dynamic Solution Architecture

```text
Selected Parent Assembly (newPlan.items[0])
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
Direct BOM Materials         Direct Components
(Level 0: depth === 0        (item.components)
 or category === 'CORE'             │
 or source === parent)       ┌──────┴──────┐
    │                        ▼             ▼
    │                   Bought-Out      32 Part
    │                     Items          Items
    │                  (BO, Hardware,      │
    │                   Consumable)        │
    │                        │             │
    └──────────┬─────────────┘             │
               ▼                           ▼
    Materials Section Only            Part Section
    (35 Items Identified)             (32 Items - Untouched)
```

---

## 3. What to Do in `ProductionPlan.jsx`

All modifications are strictly isolated within `const planDetails = useMemo(() => { ... })` in `frontend/src/pages/ProductionPlan.jsx`.

### Step 1: Identify Parent Assembly Dynamically
```javascript
// Each item in newPlan.items represents a selected Parent Assembly
const parentCodes = new Set(
  newPlan.items.flatMap(item => [
    String(item.itemCode || item.item_code || '').trim().toUpperCase(),
    String(item.drawing_no || '').trim().toUpperCase(),
    String(item.bom_no || item.bomNo || '').trim().toUpperCase()
  ]).filter(Boolean)
);
```

### Step 2: Collect ONLY Direct Materials of the Parent Assembly
Filter `item.materials` to include only materials belonging directly to this Parent Assembly:
```javascript
// A material directly belongs to the Parent Assembly if:
// 1. depth is 0 (or undefined/null in direct BOMs), OR
// 2. material_category is 'CORE', OR
// 3. source_assembly is null/empty or equals the parent item itself, AND
// 4. source_assembly does NOT match any child sub-assembly/part
const isDirectParentMaterial = (
  mat.depth === 0 ||
  mat.material_category === 'CORE' ||
  !mat.source_assembly ||
  parentCodes.has(String(mat.source_assembly).trim().toUpperCase())
);
```
Materials whose `source_assembly` is a child part are excluded from this table.

### Step 3: Extract Direct Bought-Out Items from the Parent Assembly
In `item.components`, identify direct components that are Bought-Out items:
```javascript
const isBoughtOutComponent = (comp) => {
  const group = String(comp.item_group || '').toUpperCase().trim();
  const code = String(comp.component_code || comp.item_code || '').toUpperCase().trim();
  const desc = String(comp.description || '').toUpperCase();
  
  return (
    group.includes('BOUGHT') ||
    group.includes('CONSUMABLE') ||
    group.includes('HARDWARE') ||
    group.includes('STANDARD') ||
    code.startsWith('BO-') ||
    code.startsWith('BO_') ||
    code.startsWith('CONS-') ||
    comp.is_bought_out === true ||
    comp.is_bought_out === 1
  );
};
```
Map each direct Bought-Out item into the material structure:
- `item_code`: `comp.component_code || comp.item_code`
- `material_name`: `comp.description || comp.item_name`
- `material_category`: `'CORE'`
- `totalDesignQty`: `baseQty * itemPlannedQty`
- `totalPlannedQty`: `baseQty * itemPlannedQty`
- `required_qty`: `baseQty * itemPlannedQty`
- `uom`: `comp.unit || comp.uom || 'Nos'`
- `warehouse`: `comp.warehouse || comp.targetWarehouse || 'Store - NC'`
- `bom_no`: `comp.bom_no || item.bom_no`
- `is_kg_material`: `false`

### Step 4: Keep Part Section (`subAssembliesToDisplay`) Clean
Manufactured parts (the 32 Part items) remain in `subAssembliesToDisplay`:
```javascript
const subAssembliesToDisplay = rawComponents.filter(c => {
  // Exclude consumables and direct bought-out items from the Part table
  return !isBoughtOutComponent(c) && !String(c.itemCode || c.item_code || '').toUpperCase().startsWith('CON-');
});
```
This ensures the 32 Part items remain in the Part section, while Bought-Out items are placed in the Materials section.

### Step 5: Consolidate & Deduplicate Materials
Combine direct Parent Assembly materials and direct Bought-Out items into `materialsToDisplay`:
- Use existing composite key: `${itemCodeKey}_${matName}_${uom}_${dimensions}`.
- If identical items appear, aggregate quantities and merge BOM references.
- For our parent assembly, this yields the complete **35 Materials items** directly belonging to the Parent Assembly BOM.

---

## 4. Strict "Do Not Touch" Policy

| Module / Section | Status | Guarantee |
| :--- | :---: | :--- |
| **Strategic Parameters (01)** | Unchanged | Sales order, customer info, order quantities untouched |
| **Assembly Items (02)** | Unchanged | Parent assembly item row, dates, status untouched |
| **Scope to Produce / Part (03)** | Unchanged | All 32 Part items, warehouses, dates, ops buttons untouched |
| **Operations Accordions** | Unchanged | Routing, cycle times, setup times untouched |
| **Work Orders & Material Requests** | Unchanged | Downstream creation logic untouched |
| **Backend & Database** | Unchanged | Zero backend controller, service, or migration edits |
| **Submission Payload** | Unchanged | Sends standard `materials` array to `POST/PUT /production-plans` |

---

## 5. Summary of Deliverables

1. **File to update:** [`frontend/src/pages/ProductionPlan.jsx`](file:///c:/Users/DELL/Documents/GitHub/Aluminium-erp/frontend/src/pages/ProductionPlan.jsx) only.
2. **Dynamic Logic:** Identifies the selected parent assembly from `newPlan.items`, filters materials to direct parent level, pulls direct parent bought-out items, and preserves the 32 Part items in the Part section.
3. **No Hardcoding:** Works dynamically for any BOM number or drawing number across the entire ERP.
