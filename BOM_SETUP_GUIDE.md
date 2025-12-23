# BOM Module Setup & Testing Guide

## Overview
This guide provides step-by-step instructions to set up the Bill of Materials (BOM) module with mock data and verify all functionality.

## Database Structure

### BOM Tables
1. **bom** - Main BOM master table
2. **bom_line** - BOM line items (materials/components)
3. **bom_operation** - Manufacturing operations
4. **bom_scrap** - Scrap/waste items

## Setup Steps

### Step 1: Fix Database Schema
Run the schema fix script to add any missing columns:

```bash
cd backend
mysql -u root -p aluminium_erp < scripts/fix_bom_tables.sql
```

Expected output:
- Adds missing columns to `bom_line`: warehouse, operation, rate, amount
- Adds missing columns to `bom`: product_name, process_loss_percentage, total_cost, is_default

### Step 2: Insert Mock Data
Execute the BOM mock data script:

```bash
mysql -u root -p aluminium_erp < scripts/insert_bom_mock_data.sql
```

**OR** Use the Node.js setup script (recommended - with verification):

```bash
node scripts/setup_bom_data.js
```

This will:
- Create 5 sample BOMs with different statuses (Active/Draft)
- Add 15+ line items (materials/components)
- Add 12+ manufacturing operations
- Add 5+ scrap items
- Display a verification summary table

### Step 3: Start the Application
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Step 4: Verify Data in Database

```sql
-- Check total counts
SELECT COUNT(*) as total_boms FROM bom;
SELECT COUNT(*) as total_lines FROM bom_line;
SELECT COUNT(*) as total_operations FROM bom_operation;
SELECT COUNT(*) as total_scrap FROM bom_scrap;

-- Get complete BOM summary
SELECT 
  b.bom_id, 
  b.product_name, 
  b.status, 
  COUNT(DISTINCT bl.line_id) as material_count,
  COUNT(DISTINCT bo.operation_id) as operation_count,
  COUNT(DISTINCT bs.scrap_id) as scrap_count
FROM bom b
LEFT JOIN bom_line bl ON b.bom_id = bl.bom_id
LEFT JOIN bom_operation bo ON b.bom_id = bo.bom_id
LEFT JOIN bom_scrap bs ON b.bom_id = bs.bom_id
GROUP BY b.bom_id
ORDER BY b.created_at DESC;
```

## Frontend Testing

### Access BOM Page
Navigate to: **http://localhost:5173/production/boms**

### Expected Features
1. ✅ BOM List with 5 sample items
2. ✅ KPI Cards showing:
   - Total BOMs: 5
   - Active BOMs: 3
   - Draft BOMs: 2
   - Total Cost: ₹8,050.00 (sum of all BOM costs)
3. ✅ Filter by Status (Active/Draft/Inactive)
4. ✅ Search functionality
5. ✅ Edit BOM button
6. ✅ Delete BOM button
7. ✅ Create New BOM button

### Test Cases

#### Test 1: View All BOMs
- Click on /production/boms
- ✅ Should display 5 BOMs
- ✅ Should show KPI summary
- ✅ Should load without errors

#### Test 2: Filter by Status
- Filter by "Active"
- ✅ Should show 3 BOMs (STD-ALUM, PREM-ALUM, IND-PROFILE)
- Filter by "Draft"
- ✅ Should show 2 BOMs (BASIC-SHEET, CUSTOM-ASSEM)

#### Test 3: Search Functionality
- Search for "Premium"
- ✅ Should filter to show PREM-ALUM-FRAME-002
- Search for "Frame"
- ✅ Should show 2 BOMs with "Frame" in name
- Search for "BOM-STD"
- ✅ Should show matching BOM

#### Test 4: View BOM Details
- Click Edit on any BOM
- ✅ Should navigate to BOM form with full details
- ✅ Should show materials/components (bom_line items)
- ✅ Should show operations (bom_operation items)
- ✅ Should show scrap items (bom_scrap items)
- ✅ Should show cost calculations

#### Test 5: Create New BOM
- Click "+ New BOM" button
- ✅ Should navigate to empty form
- Fill in: item_code, product_name, description, quantity, uom
- ✅ Should be able to add line items
- ✅ Should be able to add operations
- ✅ Should be able to add scrap items
- Click Save
- ✅ Should create new BOM with unique ID

#### Test 6: Edit Existing BOM
- Click Edit on any BOM
- ✅ Should populate all fields
- Update some fields
- Click Save
- ✅ Should update successfully
- ✅ Should show success message

#### Test 7: Delete BOM
- Click Delete icon on any BOM
- ✅ Should show confirmation dialog
- Confirm deletion
- ✅ Should delete BOM
- ✅ Should refresh list
- ✅ Count should decrease by 1

## API Endpoints

### Get All BOMs
```bash
GET http://localhost:3000/production/boms
```

Query Parameters:
- `status` - Filter by status (Active/Draft/Inactive)
- `search` - Search by BOM ID or item code
- `item_code` - Filter by specific item code

Response:
```json
{
  "success": true,
  "data": [
    {
      "bom_id": "BOM-STD-ALUM-FRAME-001",
      "item_code": "ITEM-ALUMINIUMS",
      "product_name": "Standard Aluminum Frame",
      "status": "Active",
      "total_cost": 1250.00,
      "revision": 1,
      "quantity": 1.0,
      "uom": "Kg",
      "created_at": "2025-12-23T...",
      "updated_at": "2025-12-23T..."
    },
    ...
  ]
}
```

### Get BOM Details
```bash
GET http://localhost:3000/production/boms/BOM-STD-ALUM-FRAME-001
```

Response:
```json
{
  "success": true,
  "data": {
    "bom_id": "BOM-STD-ALUM-FRAME-001",
    "item_code": "ITEM-ALUMINIUMS",
    "product_name": "Standard Aluminum Frame",
    "status": "Active",
    "total_cost": 1250.00,
    "lines": [
      {
        "line_id": 1,
        "component_code": "ITEM-ALUMINIUMS",
        "quantity": 5.0,
        "rate": 250.00,
        "amount": 1250.00
      },
      ...
    ],
    "operations": [
      {
        "operation_id": 1,
        "operation_name": "Cutting",
        "operation_time": 15.00,
        "operating_cost": 50.00
      },
      ...
    ],
    "scrapItems": [
      {
        "scrap_id": 1,
        "item_code": "ITEM-SCRAP-ALUM",
        "item_name": "Aluminum Scrap Waste",
        "quantity": 0.15,
        "rate": 50.00
      }
    ]
  }
}
```

### Create BOM
```bash
POST http://localhost:3000/production/boms
Content-Type: application/json

{
  "item_code": "ITEM-NEW-PRODUCT",
  "product_name": "New Product BOM",
  "description": "BOM for new product",
  "quantity": 1.0,
  "uom": "Unit",
  "status": "Draft",
  "is_active": true,
  "is_default": false,
  "materials": [
    {
      "item_code": "ITEM-ALUMINIUMS",
      "quantity": 5.0,
      "uom": "Kg",
      "rate": 250.00
    }
  ],
  "operations": [
    {
      "operation_id": "op-cutting",
      "operation_name": "Cutting",
      "operation_time": 15.00,
      "fixed_time": 5.00,
      "cost": 50.00
    }
  ]
}
```

### Update BOM
```bash
PUT http://localhost:3000/production/boms/BOM-STD-ALUM-FRAME-001
Content-Type: application/json

{
  "product_name": "Updated Product Name",
  "description": "Updated description",
  "status": "Active",
  "total_cost": 1500.00
}
```

### Delete BOM
```bash
DELETE http://localhost:3000/production/boms/BOM-STD-ALUM-FRAME-001
```

## Mock Data Overview

### BOMs Created
1. **BOM-STD-ALUM-FRAME-001** (Active)
   - Standard Aluminum Frame
   - Cost: ₹1,250.00
   - 4 materials, 4 operations, 1 scrap item

2. **BOM-PREM-ALUM-FRAME-002** (Active)
   - Premium Aluminum Frame
   - Cost: ₹1,850.00
   - 3 materials, 4 operations, 2 scrap items

3. **BOM-BASIC-SHEET-003** (Draft)
   - Basic Aluminum Sheet
   - Cost: ₹850.00
   - 1 material, 1 operation

4. **BOM-CUSTOM-ASSEM-004** (Draft)
   - Custom Aluminum Assembly
   - Cost: ₹2,500.00
   - 3 materials (with NULL rate), 2 operations (with NULL values)

5. **BOM-IND-PROFILE-005** (Active)
   - Industrial Aluminum Profile
   - Cost: ₹1,650.00
   - 1 material, 2 operations, 1 scrap item

## Data Integrity Checks

The mock data includes:
- ✅ BOMs with different statuses (Active/Draft)
- ✅ BOMs with both is_active=true and is_active=false
- ✅ BOMs with and without is_default set
- ✅ Materials with complete data (rate, amount)
- ✅ Materials with NULL rate/amount for edge case testing
- ✅ Operations with all fields
- ✅ Operations with NULL fixed_time and operating_cost
- ✅ Scrap items with NULL rate values
- ✅ Proper foreign key relationships
- ✅ Correct cascading deletes configured

## Troubleshooting

### Error: "Unknown column 'product_name' in 'field list'"
**Solution**: Run the schema fix script:
```bash
mysql -u root -p aluminium_erp < scripts/fix_bom_tables.sql
```

### Error: "Failed to fetch BOMs"
**Steps**:
1. Check backend is running: `npm start` in /backend directory
2. Check database connection: Verify DB credentials in .env
3. Check API endpoint: GET http://localhost:3000/production/boms
4. Check browser console for actual error message

### No Data Shows in Frontend
**Steps**:
1. Verify data in database:
   ```sql
   SELECT COUNT(*) FROM bom;
   ```
2. Check if data was inserted:
   ```sql
   SELECT * FROM bom LIMIT 5;
   ```
3. Clear browser cache and refresh page
4. Check network tab in DevTools for API response

### Calculation Issues (Cost, Total)
**Verify**:
- Each bom_line has rate and amount values
- BOM total_cost is sum of all line amounts
- No NULL values in critical fields (quantity, rate)

## Performance Notes

- With 5 BOMs and ~20 line items, API response is typically < 100ms
- Frontend pagination set to 10 items per page
- Filter operations are instant for < 100 BOMs
- Search functionality uses LIKE with indexes for fast queries

## Next Steps

1. ✅ Run schema fix script
2. ✅ Insert mock data (use setup_bom_data.js)
3. ✅ Start frontend and backend
4. ✅ Test all CRUD operations
5. ✅ Test filtering and search
6. ✅ Test error handling
7. ✅ Create actual BOMs for your products

## Commands Quick Reference

```bash
# Fix schema
mysql -u root -p aluminium_erp < backend/scripts/fix_bom_tables.sql

# Insert data (with Node.js verification)
node backend/scripts/setup_bom_data.js

# Or insert via MySQL directly
mysql -u root -p aluminium_erp < backend/scripts/insert_bom_mock_data.sql

# Start backend
cd backend && npm start

# Start frontend
cd frontend && npm run dev

# Test API
curl http://localhost:3000/production/boms

# View database
mysql -u root -p aluminium_erp -e "SELECT * FROM bom LIMIT 5;"
```

## Support

For issues or questions:
1. Check this guide completely
2. Review API responses in browser DevTools
3. Check backend console for error messages
4. Verify database has data: `SELECT COUNT(*) FROM bom;`
