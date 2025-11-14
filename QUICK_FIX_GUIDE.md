# 🚨 Quick Fix Guide - Database Schema Errors

## Error Summary
```
❌ POST /api/material-requests 500 (Internal Server Error)
   Error: "Failed to create material request: Unknown column 'mr_item_id' in 'field list'"

❌ GET /api/items/groups 400 (Bad Request)
```

---

## ✅ Solution - Choose ONE method

### Method 1: Run Node.js Migration Script (RECOMMENDED)

**Step 1: Navigate to backend directory**
```powershell
cd c:\repo\backend
```

**Step 2: Run the migration script**
```powershell
node scripts/fix-material-request-schema.js
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║  Material Request Item Schema Migration                   ║
║  Converting: id INT → mr_item_id VARCHAR(50)             ║
╚════════════════════════════════════════════════════════════╝

📡 Connecting to database: aluminium_erp
✅ Connection established

1️⃣  Analyzing current schema...
   Current columns: id, mr_id, item_code, qty, uom, purpose
   ⚠️  Found old schema with id column - Migration required

[... migration steps ...]

✅ Migration completed successfully!
```

---

### Method 2: Direct SQL Execution

**Option A: Using MySQL Command Line**
```powershell
cd c:\repo\backend\scripts
mysql -h localhost -u root -p aluminium_erp < fix-schema.sql
```

**Option B: Using MySQL Workbench**
1. Open MySQL Workbench
2. Click: File → Open SQL Script
3. Select: `c:\repo\backend\scripts\fix-schema.sql`
4. Click: Execute (⚡ button)

**Option C: Direct Query Copy-Paste**
1. Open MySQL Workbench or MySQL Client
2. Connect to `aluminium_erp` database
3. Copy and paste the contents of `c:\repo\backend\scripts\fix-schema.sql`
4. Execute the script

---

## 🔍 Verification - Confirm the Fix

### After running migration, verify:

**1. Check table structure**
```sql
DESCRIBE material_request_item;
```
Should show:
```
Field        | Type              | Key
mr_item_id   | varchar(50)       | PRI
mr_id        | varchar(50)       | MUL
item_code    | varchar(50)       |
qty          | decimal(15,3)     |
uom          | varchar(10)       |
purpose      | text              |
created_at   | timestamp         |
```

**2. Test Material Request API**
```bash
# From Postman or curl
curl -X POST http://localhost:5000/api/material-requests \
  -H "Content-Type: application/json" \
  -d '{
    "requested_by_id": "USR001",
    "department": "Operations",
    "required_by_date": "2024-12-31",
    "items": [
      {
        "item_code": "ITEM001",
        "qty": 100,
        "uom": "kg",
        "purpose": "Production"
      }
    ]
  }'
```

Should return: **201 Created** (not 500 error)

**3. Check Items Groups API**
```bash
curl http://localhost:5000/api/items/groups
```

Should return: **200 OK** with list of item groups (not 400 error)

---

## 🔧 If Migration Fails

### Error: "Cannot connect to database"
✅ **Fix:**
```powershell
# Verify MySQL is running
mysql -h localhost -u root -p -e "SELECT 1;"

# Check .env file has correct credentials
cat c:\repo\backend\.env
```

### Error: "Unknown table 'material_request_item'"
✅ **Fix:**
```powershell
# Database might not be initialized yet
cd c:\repo
docker-compose down
docker-compose up -d
# Wait 10 seconds for MySQL to initialize
# Then run migration
```

### Error: "Foreign key constraint fails"
✅ **Fix:**
```powershell
# Verify item table has data
mysql -h localhost -u root -p aluminium_erp -e "SELECT COUNT(*) FROM item;"

# If empty, add sample items first
mysql -h localhost -u root -p aluminium_erp -e "
  INSERT INTO item (item_code, name, uom) VALUES 
  ('ITEM001', 'Aluminum Sheet', 'kg'),
  ('ITEM002', 'Stainless Steel Bar', 'meter');
"
```

---

## 📋 What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Primary Key | `id INT AUTO_INCREMENT` | `mr_item_id VARCHAR(50)` |
| ID Format | Auto-generated numbers | `MRI-{timestamp}-{random}` |
| Timestamp | Missing | `created_at TIMESTAMP` |
| Foreign Keys | Basic | Enhanced with indices |
| Records | Preserved | Preserved with new IDs |

---

## 🚀 Next Steps After Fix

### 1. **Refresh Browser**
```
Press: Ctrl + Shift + R (hard refresh)
Or: Ctrl + Shift + Delete (clear cache)
```

### 2. **Restart Backend Server**
```powershell
# If running in Docker
docker-compose restart backend

# If running with npm
cd c:\repo\backend
npm start
```

### 3. **Test the Material Request Form**
- Navigate to: `http://localhost:5173/buying/material-requests`
- Click: "Create Material Request"
- Fill form and submit
- Should succeed without 500 error ✅

### 4. **Check Browser Console**
- Open DevTools: F12
- Clear all errors
- Refresh page
- Should have no 500 or 400 errors

---

## 📞 Still Getting Errors?

### Check these in order:

1. **Database Connection**
```powershell
mysql -h localhost -u root -p -e "SELECT DATABASE();"
```

2. **Table Structure**
```powershell
mysql -h localhost -u root -p aluminium_erp -e "DESCRIBE material_request_item;"
```

3. **Backend Logs**
```powershell
# Check Docker logs if using Docker
docker logs backend

# Or check console output if running locally
# Look for error messages mentioning "material_request_item"
```

4. **API Test**
```powershell
curl -i http://localhost:5000/api/material-requests
```

5. **Database Backup/Restore**
```powershell
# Last resort: Restore from backup
mysql -h localhost -u root -p aluminium_erp < backup.sql
```

---

## 📁 Files Used in Migration

| File | Purpose |
|------|---------|
| `scripts/fix-material-request-schema.js` | Node.js migration script |
| `scripts/fix-schema.sql` | Direct SQL migration |
| `DATABASE_SCHEMA_FIX.md` | Detailed documentation |
| `.env` | Database credentials |

---

## ⏱️ Expected Duration

- **Method 1 (Node.js)**: 1-2 minutes
- **Method 2 (SQL)**: 1-2 minutes
- **Verification**: 2-3 minutes
- **Total**: ~5-10 minutes

---

## ✨ Success Indicators

After successful migration, you should see:
- ✅ No 500 errors on POST /api/material-requests
- ✅ No 400 errors on GET /api/items/groups
- ✅ Can create new material requests
- ✅ Can fetch material requests list
- ✅ Item groups load correctly
- ✅ No "Unknown column" errors in console

---

**Need help? Check `DATABASE_SCHEMA_FIX.md` for detailed information**