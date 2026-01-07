# Department-Wise Access Control System

## Overview

The system implements a comprehensive role-based and department-based access control system for managing document workflows across 9 independent departments. Each department has independent access, and documents flow through departments via status changes.

## Departments

1. **SALES** - Manages customer POs and orders
2. **DESIGN ENGINEERING** - Handles design work
3. **PROCUREMENT** - Manages procurement
4. **PRODUCTION** - Manages manufacturing
5. **QUALITY** - Quality assurance
6. **SHIPMENT** - Manages dispatch and delivery
7. **ACCOUNTS** - Handles billing and payments
8. **INVENTORY** - Manages stock and inventory
9. **ADMIN** - System administration

## Database Schema

### New Tables

- **departments** - Department master data
- **roles** - Department-specific roles
- **users** - User accounts with department and role assignment
- **permissions** - Fine-grained permissions
- **role_permissions** - Maps roles to permissions
- **document_access_logs** - Audit trail for document access

## Authentication

### Register New User

```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_sales",
  "email": "john@company.com",
  "password": "secure_password",
  "first_name": "John",
  "last_name": "Doe",
  "department_id": 1,  // SALES
  "role_id": 1,         // Sales Manager
  "phone": "9876543210"
}
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@company.com",
  "password": "secure_password"
}

Response:
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_sales",
    "email": "john@company.com",
    "department_id": 1,
    "department_name": "Sales",
    "role_name": "Sales Manager"
  }
}
```

### Get User Profile

```bash
GET /api/auth/profile
Authorization: Bearer <token>
```

## Department Access Rules

### SALES Department
- **Can View**: customer_pos, sales_orders, companies
- **Can Create**: customer_pos, sales_orders
- **Can Edit**: customer_pos, sales_orders
- **Can Change Status To**: DESIGN
- **Default Statuses**: DRAFT

### DESIGN ENGINEERING Department
- **Can View**: sales_orders, customer_pos, companies
- **Can Create**: (none)
- **Can Edit**: sales_orders
- **Can Change Status To**: PRODUCTION
- **Default Statuses**: DESIGN

### PRODUCTION Department
- **Can View**: sales_orders, customer_pos, companies
- **Can Create**: (none)
- **Can Edit**: sales_orders
- **Can Change Status To**: DISPATCH_PENDING
- **Default Statuses**: PRODUCTION

### SHIPMENT Department
- **Can View**: sales_orders, customer_pos, companies
- **Can Create**: (none)
- **Can Edit**: sales_orders
- **Can Change Status To**: PAYMENT_PENDING
- **Can Export**: Yes
- **Default Statuses**: DISPATCH_PENDING

### ACCOUNTS Department
- **Can View**: sales_orders, customer_pos, companies
- **Can Create**: (none)
- **Can Edit**: (none)
- **Can Change Status To**: CLOSED
- **Can Export**: Yes
- **Default Statuses**: PAYMENT_PENDING, CLOSED

### ADMIN Department
- **Can View**: All documents
- **Can Create**: All documents
- **Can Edit**: All documents
- **Can Change Status To**: All statuses
- **Full Permissions**: Yes

## Document Workflow

### Sales Order Workflow

```
DRAFT (SALES) 
  ↓ (Sales Manager approves)
DESIGN (DESIGN_ENG) 
  ↓ (Design work completes)
PRODUCTION (PRODUCTION) 
  ↓ (Manufacturing completes)
DISPATCH_PENDING (SHIPMENT) 
  ↓ (Shipped)
PAYMENT_PENDING (ACCOUNTS) 
  ↓ (Payment received)
CLOSED (ACCOUNTS)
```

### Customer PO Workflow

```
DRAFT (SALES)
  ↓
APPROVED (SALES)
```

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /verify` - Verify token
- `GET /profile` - Get current user profile

### Department Routes (`/api/departments`)

- `GET /` - Get all departments
- `GET /:id` - Get department details
- `GET /:id/users` - Get department users
- `GET /:id/roles` - Get department roles
- `GET /roles/:roleId/permissions` - Get role permissions

### User Management Routes (`/api/users`)

- `GET /` - Get all users (requires USER_MANAGE permission)
- `GET /:id` - Get user details
- `PUT /:id` - Update user (requires USER_MANAGE permission)
- `POST /:id/change-password` - Change user password
- `PUT /:id/deactivate` - Deactivate user (requires USER_MANAGE permission)
- `PUT /:id/reactivate` - Reactivate user (requires USER_MANAGE permission)
- `GET /department/:departmentId/users` - Get users by department

### Department Access Routes (`/api/access`)

- `GET /documents?documentType=sales_orders` - Get accessible documents
- `GET /document/:documentType/:documentId/view` - View document (access check)
- `POST /document/:documentType/:documentId/status` - Change document status
- `GET /workflow/:documentType` - Get document workflow
- `GET /dashboard` - Get user's access dashboard
- `GET /logs` - Get user's access logs

## Usage Examples

### Get Sales Order Workflow

```bash
GET /api/access/workflow/sales_orders
Authorization: Bearer <token>

Response:
{
  "documentType": "sales_orders",
  "workflow": [
    {
      "status": "DRAFT",
      "department": "SALES",
      "description": "Order created by Sales"
    },
    {
      "status": "DESIGN",
      "department": "DESIGN_ENG",
      "description": "Design Engineering phase"
    },
    ...
  ]
}
```

### Get Accessible Documents

```bash
GET /api/access/documents?documentType=sales_orders
Authorization: Bearer <token>

Response:
{
  "documentType": "sales_orders",
  "count": 5,
  "documents": [
    {
      "id": 1,
      "customer_po_id": 1,
      "status": "DRAFT",
      "project_name": "Project A",
      ...
    },
    ...
  ]
}
```

### Change Document Status

```bash
POST /api/access/document/sales_orders/1/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "newStatus": "DESIGN"
}

Response:
{
  "message": "Status transition allowed",
  "newStatus": "DESIGN"
}
```

### Get User Access Dashboard

```bash
GET /api/access/dashboard
Authorization: Bearer <token>

Response:
{
  "user": {
    "id": 1,
    "username": "john_sales",
    "department_id": 1,
    "department_name": "Sales",
    "role_name": "Sales Manager"
  },
  "accessRules": {
    "name": "Sales Department",
    "canAccessStatuses": [0],
    "canViewDocuments": ["customer_pos", "sales_orders", "companies"],
    "canEditDocuments": ["customer_pos", "sales_orders"],
    "canChangeStatusTo": [1],
    "permissions": [...]
  },
  "workflow": {...}
}
```

## Environment Variables

Add to `.env`:

```
JWT_SECRET=your-secret-key-here
```

## Security Features

1. **JWT Token Authentication** - All protected routes require valid JWT token
2. **Role-Based Access Control** - Fine-grained permissions per role
3. **Department-Based Authorization** - Document access restricted by department
4. **Status-Based Workflow** - Only allowed status transitions per department
5. **Audit Logging** - All document access logged in `document_access_logs`
6. **Password Hashing** - Bcrypt for secure password storage

## Installation & Setup

1. **Update Database** - Run the extended schema.sql with new tables
2. **Install Dependencies**:
   ```bash
   npm install bcrypt jsonwebtoken
   ```
3. **Set Environment Variables** - Add JWT_SECRET to .env
4. **Create Initial Users** - Register users for each department
5. **Test Authentication** - Verify login and token generation

## Integration with Existing Routes

All existing routes (`/api/companies`, `/api/customer-pos`, `/api/sales-orders`, `/api/dashboard`) now require authentication. Add `Authorization: Bearer <token>` header to all requests.

## Extending the System

To add new departments:
1. Add department to `departments` table
2. Create roles in `roles` table
3. Add permissions in `permissions` table
4. Add role_permissions mappings
5. Update `departmentAccessConfig.js` with access rules

To add new permissions:
1. Add permission to `permissions` table
2. Map permission to roles via `role_permissions`
3. Update role authorization checks

## Notes

- Each user must belong to exactly one department
- Each user must have exactly one role
- Roles are department-specific
- Permissions are assigned at the role level
- Document status flows are predefined per document type
- Only ADMIN department can perform unrestricted operations
