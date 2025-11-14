# Database Schema Fix - Material Request Item Mismatch

## 🚨 Problem Analysis

### Errors Encountered:
```
1. POST /api/material-requests 500 (Internal Server Error)
   Error: "Failed to create material request: Unknown column 'mr_item_id' in 'field list'"

2. GET /api/items/groups 400 (Bad Request)
   Possible cause: No active items in database or data integrity issue
```

### Root Cause:
**Schema version mismatch between code and database:**

| Component | Schema | Primary Key |
|-----------|--------|------------|
| **Expected (MaterialRequestModel.js)** | `database.sql` (NEW) | `mr_item_id VARCHAR(50)` |
| **Actual (in database)** | `init.sql` (OLD) | `id INT AUTO_INCREMENT` |

---

## 📊 Table Structure Comparison

### OLD Schema (Current in Database):
```sql
CREATE TABLE material_request_item (
  id INT AUTO_INCREMENT PRIMARY KEY,           -- ❌ Code expects mr_item_id
  mr_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  qty DECIMAL(10,2),
  uom VARCHAR(50),
  purpose VARCHAR(255),
  FOREIGN KEY (mr_id) REFERENCES material_request(mr_id),
  FOREIGN KEY (item_code) REFERENCES item(item_code)
);
```

### NEW Schema (Expected by Code):
```sql
CREATE TABLE material_request_item (
  mr_item_id VARCHAR(50) PRIMARY KEY,          -- ✅ Matches code expectations
  mr_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  qty DECIMAL(15,3),
  uom VARCHAR(10),
  purpose TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mr_id) REFERENCES material_request(mr_id),
  FOREIGN KEY (item_code) REFERENCES item(item_code),
  INDEX idx_mr (mr_id)
);
```

---

## 🔧 Solution

### Option 1: Quick SQL Migration (Recommended)

Run these SQL commands directly on your database:

```sql
-- 1. Get current data
CREATE TEMPORARY TABLE material_request_item_backup AS 
SELECT * FROM material_request_item;

-- 2. Drop old table
DROP TABLE IF EXISTS material_request_item;

-- 3. Create new table with correct schema
CREATE TABLE material_request_item (
  mr_item_id VARCHAR(50) PRIMARY KEY,
  mr_id VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  qty DECIMAL(15,3),
  uom VARCHAR(10),
  purpose TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mr_id) REFERENCES material_request(mr_id),
  FOREIGN KEY (item_code) REFERENCES item(item_code),
  INDEX idx_mr (mr_id)
);

-- 4. Restore data with new IDs
INSERT INTO material_request_item (mr_item_id, mr_id, item_code, qty, uom, purpose, created_at)
SELECT 
  CONCAT('MRI-', UNIX_TIMESTAMP(NOW()), '-', id) as mr_item_id,
  mr_id,
  item_code,
  qty,
  uom,
  purpose,
  NOW() as created_at
FROM material_request_item_backup;

-- 5. Drop temp table
DROP TEMPORARY TABLE material_request_item_backup;

-- 6. Verify
SELECT COUNT(*) FROM material_request_item;
```

### Option 2: Using Node.js Migration Script

```bash
cd c:\repo\backend
node scripts/fix-material-request-schema.js
```

---

## 🛠️ Additional Fixes Needed

### Fix 1: Update database.sql and init.sql consistency

The `init.sql` file should match `database.sql` for all tables. Currently they diverge.

**Action Required:**
- Replace `init.sql` with corrected version matching `database.sql`
- Or always use `database.sql` as the source of truth

### Fix 2: Ensure Item Groups Have Data

The `/api/items/groups` endpoint returns 400 if there are no items or if items table has NULL `item_group` values.

**Check:**
```sql
-- Verify items table has data
SELECT COUNT(*) FROM item;

-- Check for NULL item_group values
SELECT * FROM item WHERE item_group IS NULL OR item_group = '';

-- Update NULL values
UPDATE item SET item_group = 'General' WHERE item_group IS NULL OR item_group = '';
```

---

## ✅ Implementation Steps

### Step 1: Backup Database
```bash
# Create backup before making changes
mysqldump -h localhost -u root -p aluminium_erp > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply Schema Migration

**Option A - Direct SQL (in MySQL client):**
```bash
mysql -h localhost -u root -p aluminium_erp < fix-schema.sql
```

**Option B - Node.js Script:**
```bash
cd c:\repo\backend
npm install mysql2/promise dotenv  # if not already installed
node scripts/fix-material-request-schema.js
```

### Step 3: Verify Fix
```sql
-- Check new schema
DESCRIBE material_request_item;

-- Should show:
-- Field        | Type              | Key
-- mr_item_id   | varchar(50)       | PRI
-- mr_id        | varchar(50)       | MUL
-- item_code    | varchar(50)       |
-- qty          | decimal(15,3)     |
-- uom          | varchar(10)       |
-- purpose      | text              |
-- created_at   | timestamp         |

-- Verify foreign keys
SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
WHERE TABLE_NAME = 'material_request_item';
```

### Step 4: Test API Endpoints

```bash
# Test creating a material request
curl -X POST http://localhost:5000/api/material-requests \
  -H "Content-Type: application/json" \
  -d '{
    "requested_by_id": "user1",
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

# Should return: 201 Created (not 500 Internal Server Error)
```

---

## 📋 Checklist

- [ ] Backup current database
- [ ] Apply schema migration (Option A or B)
- [ ] Verify new schema structure
- [ ] Test POST /api/material-requests endpoint
- [ ] Test GET /api/material-requests endpoint
- [ ] Test GET /api/items/groups endpoint
- [ ] Verify no data loss
- [ ] Update init.sql to match database.sql

---

## 🔍 Troubleshooting

### Issue: Cannot drop table (foreign key constraint)
```sql
-- Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE material_request_item;
SET FOREIGN_KEY_CHECKS=1;
```

### Issue: Data loss after migration
```sql
-- Recover from backup
SOURCE backup_20240115_120000.sql;
```

### Issue: Still getting "Unknown column" error
```sql
-- Clear query cache (MySQL)
FLUSH QUERY CACHE;

-- Restart database server
-- OR restart Node.js application
```

---

## 🎯 Prevention for Future

### 1. Single Source of Truth
- Keep `database.sql` as the canonical schema
- Delete `init.sql` or keep it in sync automatically

### 2. Automated Migrations
- Use a migration tool like Flyway, Liquibase, or db-migrate
- Version control each migration script
- Track which migrations have been applied

### 3. CI/CD Pipeline
- Run schema validation in CI/CD
- Test migrations in staging before production
- Backup before any schema changes

### 4. Schema Validation
- Add startup checks to verify schema matches expectations
- Log warnings if schema doesn't match
- Prevent app from starting if critical tables are missing columns

---

## 📞 Need Help?

If issues persist:
1. Check MySQL error logs: `tail -f /var/log/mysql/error.log`
2. Verify database connectivity: `mysql -h localhost -u root -p -e "SELECT 1;"`
3. Check Node.js application logs for detailed error messages
4. Ensure all foreign key references exist before migrating
5. Verify permissions: `SHOW GRANTS FOR 'root'@'localhost';`