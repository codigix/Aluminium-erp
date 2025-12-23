# BOM Module Scripts - Quick Reference

This document explains all the scripts available for setting up and testing the BOM module.

## 📁 Scripts Location
All scripts are in: `backend/scripts/`

## 🔧 Available Scripts

### 1. **fix_bom_tables.sql** - Database Schema Fixes
**Purpose**: Add missing columns to BOM tables

**Usage**:
```bash
cd backend/scripts
mysql -h localhost -u root -p<password> aluminium_erp < fix_bom_tables.sql
```

**What it does**:
- Adds `product_name` to `bom` table
- Adds `process_loss_percentage` to `bom` table
- Adds `total_cost` to `bom` table
- Adds `is_default` to `bom` table
- Adds `warehouse`, `operation`, `rate`, `amount` to `bom_line` table

**When to run**: Before inserting mock data (first step)

**Idempotent**: ✅ Yes - uses `IF NOT EXISTS` so safe to run multiple times

---

### 2. **insert_bom_mock_data.sql** - Mock Data Insertion
**Purpose**: Populate database with realistic BOM test data

**Usage**:
```bash
cd backend/scripts
mysql -h localhost -u root -p<password> aluminium_erp < insert_bom_mock_data.sql
```

**What it creates**:
- 5 complete BOMs (Active/Draft status)
- 15+ Line Items (materials/components)
- 12+ Manufacturing Operations
- 5+ Scrap Items
- Includes edge cases (NULL values, different types)

**Sample BOMs created**:
1. **BOM-STD-ALUM-FRAME-001** (Active) - ₹1,250.00
2. **BOM-PREM-ALUM-FRAME-002** (Active) - ₹1,850.00  
3. **BOM-BASIC-SHEET-003** (Draft) - ₹850.00
4. **BOM-CUSTOM-ASSEM-004** (Draft) - ₹2,500.00
5. **BOM-IND-PROFILE-005** (Active) - ₹1,650.00

**When to run**: After fixing schema (second step)

---

### 3. **setup_bom_data.js** - Automated Setup with Verification
**Purpose**: Insert mock data with progress reporting and verification

**Usage**:
```bash
cd backend
node scripts/setup_bom_data.js
```

**What it does**:
1. Connects to MySQL database
2. Checks existing BOM data
3. Inserts all mock data from SQL file
4. Verifies insertion counts
5. Displays summary table of created BOMs
6. Shows API endpoints to test
7. Provides next steps

**Output**:
```
🔌 Connecting to database...
✅ Connected successfully

📊 Checking existing data...
   Current BOMs: 0
   Current BOM Lines: 0
   Current BOM Operations: 0
   Current BOM Scrap Items: 0

📝 Reading SQL script...

⏳ Inserting BOM data...
✅ Inserted 44 records

📊 Verifying inserted data...
   Total BOMs: 5
   Total BOM Lines: 15
   Total BOM Operations: 12
   Total BOM Scrap Items: 5

📋 BOM Summary:
┌─────────────────────────┬──────────────────┬────────┬─────────┐
│ BOM ID                  │ Product          │ Status │ Cost    │
├─────────────────────────┼──────────────────┼────────┼─────────┤
│ BOM-STD-ALUM-FRAME-001  │ Standard ...     │ Active │ ₹1,250  │
│ BOM-PREM-ALUM-FRAME-002 │ Premium ...      │ Active │ ₹1,850  │
...

🧪 API Endpoint Test (Simulated):
   GET /production/boms - Returns all BOMs
   ✅ Would return 5 BOMs
   ...
```

**Requirements**:
- Node.js with ES modules support
- MySQL 2/promise package installed
- Database running and accessible

**Note**: Requires proper database credentials in .env or environment variables

**When to run**: Instead of running SQL scripts directly (optional)

---

### 4. **test_bom_api.js** - API Testing Suite
**Purpose**: Verify BOM API endpoints are working correctly

**Usage**:
```bash
cd backend
npm start  # In one terminal
```

```bash
cd backend
node scripts/test_bom_api.js  # In another terminal
```

**What it tests**:
1. ✅ Backend health check
2. ✅ Get all BOMs
3. ✅ Filter BOMs by status
4. ✅ Get BOM details (with lines, operations, scrap)
5. ✅ Search BOMs by keyword
6. ✅ Database statistics

**Output**:
```
🧪 BOM API Test Suite

📡 Test 1: Backend Health Check
✅ Backend is running

📋 Test 2: Get All BOMs
✅ Retrieved 5 BOMs
   Sample BOM:
   - ID: BOM-STD-ALUM-FRAME-001
   - Item: ITEM-ALUMINIUMS
   - Status: Active
   - Cost: ₹1250

... (more tests)

📈 Test Summary
✅ Passed: 6
❌ Failed: 0
📊 Total: 6

🎯 Success Rate: 100%

🎉 All tests passed! BOM API is working correctly.
```

**Prerequisites**:
- Backend must be running (npm start)
- Database must have BOM data (from step 2 or 3)
- Axios package installed

**When to run**: After backend is started to verify API works

---

## 🚀 Complete Setup Workflow

### Option A: Using SQL Scripts (Recommended for simple setup)
```bash
# Step 1: Fix database schema
cd backend/scripts
mysql -h localhost -u root -p<password> aluminium_erp < fix_bom_tables.sql

# Step 2: Insert mock data
mysql -h localhost -u root -p<password> aluminium_erp < insert_bom_mock_data.sql

# Step 3: Start backend
cd ..
npm start
```

### Option B: Using Node.js Script (Recommended for verification)
```bash
# Step 1: Fix database schema
cd backend/scripts
mysql -h localhost -u root -p<password> aluminium_erp < fix_bom_tables.sql

# Step 2: Insert mock data with verification
cd ..
node scripts/setup_bom_data.js

# Step 3: Start backend
npm start
```

### Option C: Full Setup with Testing (Recommended for development)
```bash
# Step 1: Fix schema
cd backend/scripts
mysql -h localhost -u root -p<password> aluminium_erp < fix_bom_tables.sql

# Step 2: Insert data with verification
cd ..
node scripts/setup_bom_data.js

# Step 3: Terminal 1 - Start backend
npm start

# Step 4: Terminal 2 - Test API
node scripts/test_bom_api.js

# Step 5: Terminal 3 - Start frontend (in frontend directory)
npm run dev
```

## 🔍 Verification Commands

### Check if data was inserted
```sql
mysql> SELECT COUNT(*) as total_boms FROM bom;
mysql> SELECT COUNT(*) as total_lines FROM bom_line;
mysql> SELECT COUNT(*) as total_operations FROM bom_operation;
mysql> SELECT COUNT(*) as total_scrap FROM bom_scrap;
```

### View BOM Summary
```sql
mysql> SELECT 
  b.bom_id, 
  b.product_name, 
  b.status, 
  COUNT(DISTINCT bl.line_id) as materials,
  COUNT(DISTINCT bo.operation_id) as operations,
  COUNT(DISTINCT bs.scrap_id) as scrap_items
FROM bom b
LEFT JOIN bom_line bl ON b.bom_id = bl.bom_id
LEFT JOIN bom_operation bo ON b.bom_id = bo.bom_id
LEFT JOIN bom_scrap bs ON b.bom_id = bs.bom_id
GROUP BY b.bom_id;
```

### View a specific BOM
```sql
mysql> SELECT * FROM bom WHERE bom_id = 'BOM-STD-ALUM-FRAME-001';
mysql> SELECT * FROM bom_line WHERE bom_id = 'BOM-STD-ALUM-FRAME-001';
mysql> SELECT * FROM bom_operation WHERE bom_id = 'BOM-STD-ALUM-FRAME-001';
mysql> SELECT * FROM bom_scrap WHERE bom_id = 'BOM-STD-ALUM-FRAME-001';
```

## ❌ Troubleshooting Scripts

### Issue: "Access denied for user 'root'@'localhost'"
**Solutions**:
1. Check MySQL password: `mysql -u root -p`
2. If no password, don't use `-p` flag
3. Update .env file with `DB_PASSWORD`
4. For Node.js scripts, set environment: `DB_PASSWORD=yourpass node scripts/setup_bom_data.js`

### Issue: "Unknown column 'product_name'"
**Solution**: Run the fix_bom_tables.sql script first

### Issue: "Script execution hangs"
**Solution**: Press Ctrl+C and check:
1. Is MySQL running? `mysql -u root -e "SELECT 1"`
2. Is database name correct? (Should be `aluminium_erp`)
3. Check port: Default is 3306

### Issue: Backend not responding during test
**Solution**:
1. Ensure backend is running: `npm start` in backend directory
2. Check port 3000 is open: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (Mac/Linux)
3. Check Node version: `node --version` (should be v14+ for ES modules)

## 📝 Script Dependencies

| Script | Requires | Optional |
|--------|----------|----------|
| fix_bom_tables.sql | MySQL CLI | - |
| insert_bom_mock_data.sql | MySQL CLI | - |
| setup_bom_data.js | Node.js, mysql2/promise | - |
| test_bom_api.js | Node.js, axios | Running backend |

## 🎯 Expected Results

After running all setup scripts:
- ✅ 5 BOMs created
- ✅ 15 line items
- ✅ 12 operations
- ✅ 5 scrap items
- ✅ All relationships intact (Foreign Keys working)
- ✅ API endpoints responding
- ✅ Frontend displaying data

## 📚 Related Documentation

- **BOM_SETUP_GUIDE.md** - Comprehensive setup and testing guide
- **BOM_IMPLEMENTATION_STATUS.md** - Current implementation status and checklist
- **BOM.jsx** - Frontend component location and structure

## 🔗 Useful Links

- Backend API Docs: Available in ProductionController.js
- Frontend Component: `frontend/src/pages/Production/BOM.jsx`
- Production Routes: `backend/src/routes/production.js`
- Production Model: `backend/src/models/ProductionModel.js`

## 💡 Tips

1. **Always run schema fix first** - Before inserting data
2. **Use verification script** - To see progress and any errors
3. **Test API** - Before testing frontend
4. **Check logs** - Backend console shows detailed error messages
5. **Database backup** - Consider backing up before running scripts
6. **Run one script at a time** - To identify any issues quickly

## 🎉 You're all set!

Once all scripts run successfully:
1. Navigate to: http://localhost:5173/production/boms
2. You should see all 5 BOMs with full details
3. Test all CRUD operations
4. Review the BOM_SETUP_GUIDE.md for detailed test cases
