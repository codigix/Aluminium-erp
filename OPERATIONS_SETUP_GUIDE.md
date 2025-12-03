# Operations Module Setup Guide

## Overview
The Operations module allows you to create, manage, and display manufacturing operations with sub-operations, workstations, and batch size configurations.

## Database Setup

### Step 1: Create Operations Tables
Run the SQL script to create the operations tables:

```sql
-- Option A: Using MySQL CLI
mysql -u root -p aluminium_erp < backend/scripts/create-operations-table.sql

-- Option B: Using your database client (e.g., MySQL Workbench, phpMyAdmin)
-- Copy and paste the contents of backend/scripts/create-operations-table.sql
```

### Step 2: Seed Sample Data (Optional)
To add sample operations to your database:

```sql
-- Option A: Using MySQL CLI
mysql -u root -p aluminium_erp < backend/scripts/seed-operations.sql

-- Option B: Using your database client
-- Copy and paste the contents of backend/scripts/seed-operations.sql
```

### Tables Created

#### operation table
| Field | Type | Description |
|-------|------|-------------|
| name | VARCHAR(100) PRIMARY KEY | Unique operation identifier |
| operation_name | VARCHAR(255) | Display name for the operation |
| default_workstation | VARCHAR(100) | Associated workstation |
| is_corrective_operation | BOOLEAN | Whether this is a corrective operation |
| create_job_card_based_on_batch_size | BOOLEAN | Auto-create job cards for batches |
| batch_size | INT | Batch size if job card creation is enabled |
| quality_inspection_template | VARCHAR(100) | QC template reference |
| description | LONGTEXT | Operation description |
| status | ENUM('active', 'inactive', 'draft') | Operation status |
| created_at | TIMESTAMP | Creation timestamp |
| modified | TIMESTAMP | Last modified timestamp |

#### operation_sub_operation table
| Field | Type | Description |
|-------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| operation_name | VARCHAR(100) | Reference to operation |
| no | INT | Sub-operation sequence number |
| operation | VARCHAR(255) | Sub-operation description |
| operation_time | DECIMAL(10, 2) | Time required in hours |

## Backend API Endpoints

### Create Operation
**POST** `/api/production/operations`
```json
{
  "name": "ENGRAVING",
  "operation_name": "ENGRAVING",
  "default_workstation": "Engraving Station",
  "is_corrective_operation": false,
  "create_job_card_based_on_batch_size": false,
  "batch_size": 1,
  "quality_inspection_template": "QC-001",
  "description": "Engraving operation for product marking",
  "sub_operations": [
    {"no": 1, "operation": "Prepare Surface", "operation_time": 0.5},
    {"no": 2, "operation": "Engrave", "operation_time": 1.5}
  ]
}
```

### Get All Operations
**GET** `/api/production/operations`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "ENGRAVING",
      "operation_name": "ENGRAVING",
      "default_workstation": "Engraving Station",
      "is_corrective_operation": false,
      "status": "active",
      "modified": "2025-11-26T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Get Operation Details
**GET** `/api/production/operations/:operation_id`

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "ENGRAVING",
    "operation_name": "ENGRAVING",
    "default_workstation": "Engraving Station",
    "sub_operations": [
      {"no": 1, "operation": "Prepare Surface", "operation_time": 0.5},
      {"no": 2, "operation": "Engrave", "operation_time": 1.5}
    ]
  }
}
```

### Update Operation
**PUT** `/api/production/operations/:operation_id`

### Delete Operation
**DELETE** `/api/production/operations/:operation_id`

## Frontend Usage

### Operations List Page
Navigate to: `http://localhost:5173/production/operations`

Features:
- View all operations in a table
- Search operations by name
- Edit existing operations
- Delete operations
- Create new operations

### Create/Edit Operation Form
Navigate to:
- **Create**: `http://localhost:5173/production/operations/form`
- **Edit**: `http://localhost:5173/production/operations/form/:operation_name`

Features:
- Operation name input
- Default workstation selection
- Corrective operation flag
- Job card settings (conditional)
- Sub-operations management
- Operation description
- Real-time form validation

## Sample Operations to Create

Here are the operations from your screenshot to add:

```javascript
[
  { name: "sand blasting", operation_name: "sand blasting" },
  { name: "ENGRAVING", operation_name: "ENGRAVING" },
  { name: "BUFFING", operation_name: "BUFFING" },
  { name: "MACHINING OP-40", operation_name: "MACHINING OP-40" },
  { name: "MACHINING OP-30", operation_name: "MACHINING OP-30" },
  { name: "MACHINING OP-20", operation_name: "MACHINING OP-20" },
  { name: "MACHINING OP-10", operation_name: "MACHINING OP-10" },
  { name: "POWDER COATING", operation_name: "POWDER COATING" },
  { name: "HEAT TREATMENT", operation_name: "HEAT TREATMENT", default_workstation: "HEAT TREATMENT FURNACE" },
  { name: "Shot Blasting", operation_name: "Shot Blasting" },
  { name: "Core Preparation", operation_name: "Core Preparation" },
  { name: "Assembly", operation_name: "Assembly", default_workstation: "Welding Station - 01" },
  { name: "Water Leakage Testing", operation_name: "Water Leakage Testing", default_workstation: "WLT - Machine - 01" },
  { name: "Fettling", operation_name: "Fettling", default_workstation: "Line - 01" },
  { name: "Final Inspection", operation_name: "Final Inspection", default_workstation: "Inspection Table - 01" },
  { name: "Machining", operation_name: "Machining" },
  { name: "GDC", operation_name: "GDC" }
]
```

## Implementation Files

### Backend Files Created/Modified
- `backend/src/controllers/ProductionController.js` - Added operation CRUD methods
- `backend/src/models/ProductionModel.js` - Added operation model methods
- `backend/src/routes/production.js` - Added operation routes

### Frontend Files (Pre-existing, enhanced)
- `frontend/src/pages/Production/OperationForm.jsx` - Create/edit operations
- `frontend/src/pages/Production/Operations.jsx` - List operations

### Database Files
- `backend/scripts/create-operations-table.sql` - Table schema
- `backend/scripts/seed-operations.sql` - Sample data

## Troubleshooting

### API Returns 404
Make sure:
1. Database tables are created using `create-operations-table.sql`
2. Backend server is running and restarted after code changes
3. Auth token is valid (required for all endpoints)

### Operations Not Showing in List
1. Check browser console for API errors
2. Verify database has operations: `SELECT * FROM operation;`
3. Check network tab in browser dev tools

### Create Operation Fails
1. Verify operation `name` is unique
2. Check all required fields are provided
3. Review API response in browser dev tools for error details

## Quick Start

### 1. Setup Database (First time only)
```bash
mysql -u root -p aluminium_erp < backend/scripts/create-operations-table.sql
mysql -u root -p aluminium_erp < backend/scripts/seed-operations.sql
```

### 2. Start Backend
```bash
cd backend
npm install
npm start
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Access Operations Module
- List: http://localhost:5173/production/operations
- Create: http://localhost:5173/production/operations/form
- Edit: http://localhost:5173/production/operations/form/:operation_name

## API Testing with cURL

### Create Operation
```bash
curl -X POST http://localhost:5000/api/production/operations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ENGRAVING",
    "operation_name": "ENGRAVING",
    "default_workstation": "Engraving Station"
  }'
```

### Get All Operations
```bash
curl -X GET http://localhost:5000/api/production/operations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Specific Operation
```bash
curl -X GET http://localhost:5000/api/production/operations/ENGRAVING \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Operation
```bash
curl -X PUT http://localhost:5000/api/production/operations/ENGRAVING \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "default_workstation": "New Workstation"
  }'
```

### Delete Operation
```bash
curl -X DELETE http://localhost:5000/api/production/operations/ENGRAVING \
  -H "Authorization: Bearer YOUR_TOKEN"
```
